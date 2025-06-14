"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Peer, { SignalData } from "simple-peer";
import { Button } from "@/components/ui/button";
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    Monitor,
    LogOut,
    MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Socket initialization & global logging
// ─────────────────────────────────────────────────────────────────────────────
const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
    transports: ["websocket"],
    withCredentials: true,
});

// Log connection lifecycle
socket.on("connect", () =>
    console.log("✅ Socket connected:", socket.id)
);
socket.on("connect_error", (err) =>
    console.error("❌ Socket connect_error:", err)
);
// Log any incoming event
socket.onAny((event, ...args) =>
    console.log("⬅️ Client got event:", event, args)
);

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────────────────────────────────────
interface SignalPayload {
    signal: SignalData;
    callerId: string;
}
interface AllUsersPayload {
    userId: string;
    userName: string;
}
interface UserJoinedRoomPayload {
    userId: string;
    userName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function RoomPage() {
    const { id: roomId } = useParams();
    console.log("🏷️ roomId param:", roomId);

    const router = useRouter();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<
        Record<string, MediaStream>
    >({});
    const [userNames, setUserNames] = useState<Record<string, string>>({});
    const [chatMessages, setChatMessages] = useState<string[]>([]);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const peersRef = useRef<Record<string, Peer.Instance>>({});

    // ───────────────────────────────────────────────────────────────────────────
    // 1) Acquire local camera/mic
    // ───────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((stream) => {
                console.log("🎥 got local media stream");
                setLocalStream(stream);
                const vid = document.getElementById(
                    "local-video"
                ) as HTMLVideoElement;
                if (vid) vid.srcObject = stream;
            })
            .catch((err) => console.error("🔴 getUserMedia failed:", err));
    }, []);

    // ───────────────────────────────────────────────────────────────────────────
    // 2) Once we have localStream, join room and wire up all socket handlers
    // ───────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        console.log("❇️ localStream effect:", {
            localStream,
            roomId,
            connected: socket.connected,
        });
        if (!localStream) return;

        console.log("📤 Emitting join-room:", roomId);
        socket.emit("join-room", roomId);

        socket.on("all-users", (users: AllUsersPayload[]) => {
            console.log("👥 all-users payload:", users);
            users.forEach(({ userId, userName }) => {
                if (!socket.id) {
                    console.warn("Socket ID is undefined, skipping peer creation for", userId);
                    return;
                }
                console.log(`➕ Creating peer (initiator) for ${userId}`);
                const peer = createPeer(userId, socket.id, localStream);
                peersRef.current[userId] = peer;
                setUserNames((prev) => ({ ...prev, [userId]: userName }));
            });
        });

        socket.on("user-joined", ({ signal, callerId }: SignalPayload) => {
            console.log("📡 user-joined (signal) from:", callerId);
            const peer = addPeer(signal, callerId, localStream);
            peersRef.current[callerId] = peer;
        });

        socket.on(
            "receiving-returned-signal",
            ({ signal, id }: { signal: SignalData; id: string }) => {
                console.log("📶 receiving-returned-signal from", id);
                peersRef.current[id]?.signal(signal);
            }
        );

        socket.on(
            "user-joined-room",
            ({ userId, userName }: UserJoinedRoomPayload) => {
                console.log("📣 user-joined-room:", userId, userName);
                setUserNames((prev) => ({ ...prev, [userId]: userName }));
                toast.success(`${userName} joined the meeting`);
            }
        );

        socket.on("user-left", (socketId: string) => {
            console.log("📤 user-left:", socketId);
            toast(`${userNames[socketId] ?? "Someone"} left`);
            setRemoteStreams((prev) => {
                const c = { ...prev };
                delete c[socketId];
                return c;
            });
            setUserNames((prev) => {
                const c = { ...prev };
                delete c[socketId];
                return c;
            });
            peersRef.current[socketId]?.destroy();
            delete peersRef.current[socketId];
        });

        socket.on("chat-message", (msg: string) => {
            console.log("💬 chat-message:", msg);
            setChatMessages((prev) => [...prev, msg]);
        });

        return () => {
            socket.off("all-users");
            socket.off("user-joined");
            socket.off("receiving-returned-signal");
            socket.off("user-joined-room");
            socket.off("user-left");
            socket.off("chat-message");
        };
    }, [localStream]);

    // ───────────────────────────────────────────────────────────────────────────
    // Peer helpers
    // ───────────────────────────────────────────────────────────────────────────
    const createPeer = (
        userToSignal: string,
        callerId: string,
        stream: MediaStream
    ): Peer.Instance => {
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peer.on("signal", (signal) => {
            console.log("🔔 createPeer.signal →", userToSignal);
            socket.emit("sending-signal", { userToSignal, callerId, signal });
        });
        peer.on("stream", (s) => {
            console.log("🖥️ createPeer.stream from", userToSignal);
            setRemoteStreams((prev) => ({ ...prev, [userToSignal]: s }));
        });
        return peer;
    };

    const addPeer = (
        incomingSignal: SignalData,
        callerId: string,
        stream: MediaStream
    ): Peer.Instance => {
        const peer = new Peer({ initiator: false, trickle: false, stream });
        peer.on("signal", (signal) => {
            console.log("🔔 addPeer.signal back to", callerId);
            socket.emit("returning-signal", { signal, callerId });
        });
        peer.signal(incomingSignal);
        peer.on("stream", (s) => {
            console.log("🖥️ addPeer.stream from", callerId);
            setRemoteStreams((prev) => ({ ...prev, [callerId]: s }));
        });
        return peer;
    };

    // ───────────────────────────────────────────────────────────────────────────
    // UI Control handlers
    // ───────────────────────────────────────────────────────────────────────────
    const toggleVideo = () => {
        if (!localStream) return;
        const track = localStream.getVideoTracks()[0];
        track.enabled = !track.enabled;
        setIsVideoOn(track.enabled);
    };

    const toggleAudio = () => {
        if (!localStream) return;
        const track = localStream.getAudioTracks()[0];
        track.enabled = !track.enabled;
        setIsAudioOn(track.enabled);
    };

    const shareScreen = async () => {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        for (const peer of Object.values(peersRef.current)) {
            const oldTrack = localStream?.getVideoTracks()[0];
            if (oldTrack && localStream) {
                console.log("🔄 Replacing video track with screen share");
                peer.replaceTrack(oldTrack, screenTrack, localStream);
            }
        }
    };

    const leaveMeeting = () => {
        console.log("👋 Leaving meeting");
        Object.values(peersRef.current).forEach((peer) => peer.destroy());
        peersRef.current = {};
        socket.disconnect();
        router.push("/");
    };

    const sendChat = (msg: string) => {
        console.log("🚀 Sending chat:", msg);
        socket.emit("chat-message", msg);
        setChatMessages((prev) => [...prev, `You: ${msg}`]);
    };

    // ───────────────────────────────────────────────────────────────────────────
    // Render
    // ───────────────────────────────────────────────────────────────────────────
    const participants = [
        { id: "local", stream: localStream, name: "You" },
        ...Object.entries(remoteStreams).map(([id, stream]) => ({
            id,
            stream,
            name: userNames[id] || id,
        })),
    ];

    return (
        <div className="relative h-screen w-screen bg-black text-white">
            {/* Video Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-4">
                {participants.map(({ id, stream, name }) => (
                    <div key={id} className="relative">
                        <video
                            id={id === "local" ? "local-video" : `remote-${id}`}
                            autoPlay
                            playsInline
                            muted={id === "local"}
                            className="rounded w-full h-full object-cover"
                            ref={(el) => {
                                if (el && stream) el.srcObject = stream;
                            }}
                        />
                        <div className="absolute bottom-1 left-1 right-1 text-center bg-black/50 text-xs py-1 rounded">
                            {name}
                        </div>
                    </div>
                ))}
            </div>

            {/* Control Bar */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-lg">
                <Button onClick={toggleVideo} variant="ghost" size="icon">
                    {isVideoOn ? <Video /> : <VideoOff />}
                </Button>
                <Button onClick={toggleAudio} variant="ghost" size="icon">
                    {isAudioOn ? <Mic /> : <MicOff />}
                </Button>
                <Button onClick={shareScreen} variant="ghost" size="icon">
                    <Monitor />
                </Button>
                <Button onClick={() => setIsChatOpen((p) => !p)} variant="ghost" size="icon">
                    <MessageSquare />
                </Button>
                <Button onClick={leaveMeeting} variant="ghost" size="icon">
                    <LogOut />
                </Button>
            </div>

            {/* Chat Panel */}
            {isChatOpen && (
                <div className="absolute top-0 right-0 w-64 h-full bg-white text-black p-4 shadow-lg">
                    <h3 className="font-semibold mb-2">Chat</h3>
                    <div className="flex-1 overflow-y-auto mb-2">
                        {chatMessages.map((msg, i) => (
                            <p key={i} className="text-sm my-1">
                                {msg}
                            </p>
                        ))}
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const val = (
                                e.currentTarget.elements.namedItem("msg") as HTMLInputElement
                            ).value.trim();
                            if (val) sendChat(val);
                            e.currentTarget.reset();
                        }}
                        className="flex gap-2"
                    >
                        <input name="msg" className="flex-1 border p-2 text-sm" />
                        <Button type="submit" size="sm">
                            Send
                        </Button>
                    </form>
                </div>
            )}
        </div>
    );
}
