"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io } from "socket.io-client";
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

// ─── configure URL (fallback for local dev) ──────────────────────────────────
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
// client
const socket = io(SOCKET_URL, {
    transports: ["websocket"],       // ← no polling
    withCredentials: true,
    path: "/socket.io",
    autoConnect: false// match your server’s path
});


console.log("🔗 Attempting socket.io connection to", SOCKET_URL);

// ─── global socket logs ─────────────────────────────────────────────────────
socket.on("connect", () =>
    console.log("✅ Socket connected:", socket.id, "→", SOCKET_URL)
);
socket.on("connect_error", (err) =>
    console.error("❌ Socket connect_error:", err)
);
socket.onAny((event, ...args) =>
    console.log("⬅️ Client got event:", event, args)
);
socket.io.on("error", (err) => console.error("❌ Engine.IO error:", err));
socket.on("connect_error", (err) =>
    console.error("❌ socket connect_error:", err)
);
// ─── types ──────────────────────────────────────────────────────────────────
interface SignalPayload { signal: SignalData; callerId: string; }
interface AllUsersPayload { userId: string; userName: string; }
interface UserJoinedRoomPayload { userId: string; userName: string; }

// ─── main component ─────────────────────────────────────────────────────────
export default function RoomPage() {
    const { id: roomId } = useParams();
    console.log("🏷️ roomId param:", roomId);

    const router = useRouter();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [userNames, setUserNames] = useState<Record<string, string>>({});
    const [chatMessages, setChatMessages] = useState<string[]>([]);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const peersRef = useRef<Record<string, Peer.Instance>>({});

    // 1) getUserMedia
    useEffect(() => {
        navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((stream) => {
                console.log("🎥 got local media stream");
                setLocalStream(stream);
                const vid = document.getElementById("local-video") as HTMLVideoElement;
                if (vid) vid.srcObject = stream;
            })
            .catch((err) => console.error("🔴 getUserMedia failed:", err));
    }, []);

    // 2) once we have localStream, wait for socket to connect then emit join-room
    useEffect(() => {
        if (!localStream) return;

        console.log("Inside", socket.connected)
        if (socket.connected) {
            console.log("🔗 Already connected; emitting join-room:", roomId);
            socket.emit("join-room", roomId);
        } else {
            console.log("⌛ Waiting for socket.connect to emit join-room");
            socket.on("connect", () => {
                console.log("✅ Socket connected; emitting join-room:", roomId);
                socket.emit("join-room", roomId);
            });
        }

        // ─── socket event handlers ───────────────────────────────────────────────
        socket.on("all-users", (users: AllUsersPayload[]) => {
            console.log("👥 all-users payload:", users);
            users.forEach(({ userId, userName }) => {
                console.log(`➕ createPeer for ${userId}`);
                if (!socket.id) {
                    console.warn("Socket id is undefined, skipping createPeer for", userId);
                    return;
                }
                const peer = createPeer(userId, socket.id, localStream);
                peersRef.current[userId] = peer;
                setUserNames((p) => ({ ...p, [userId]: userName }));
            });
        });

        socket.on("user-joined", ({ signal, callerId }: SignalPayload) => {
            console.log("📡 user-joined →", callerId);
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
                setUserNames((p) => ({ ...p, [userId]: userName }));
                toast.success(`${userName} joined`);
            }
        );

        socket.on("user-left", (sid: string) => {
            console.log("📤 user-left:", sid);
            toast(`${userNames[sid] ?? "Someone"} left`);
            setRemoteStreams((p) => { const c = { ...p }; delete c[sid]; return c; });
            setUserNames((p) => { const c = { ...p }; delete c[sid]; return c; });
            peersRef.current[sid]?.destroy();
            delete peersRef.current[sid];
        });

        socket.on("chat-message", (msg: string) => {
            console.log("💬 chat-message:", msg);
            setChatMessages((p) => [...p, msg]);
        });

        return () => {
            socket.off("all-users");
            socket.off("user-joined");
            socket.off("receiving-returned-signal");
            socket.off("user-joined-room");
            socket.off("user-left");
            socket.off("chat-message");
        };
    }, [localStream, roomId]);

    // ─── Peer helpers ──────────────────────────────────────────────────────────
    const createPeer = (userToSignal: string, callerId: string, stream: MediaStream) => {
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peer.on("signal", (signal) => {
            console.log("🔔 createPeer.signal →", userToSignal);
            socket.emit("sending-signal", { userToSignal, callerId, signal });
        });
        peer.on("stream", (s) => {
            console.log("🖥️ createPeer.stream from", userToSignal);
            setRemoteStreams((p) => ({ ...p, [userToSignal]: s }));
        });
        return peer;
    };

    const addPeer = (incomingSignal: SignalData, callerId: string, stream: MediaStream) => {
        const peer = new Peer({ initiator: false, trickle: false, stream });
        peer.on("signal", (signal) => {
            console.log("🔔 addPeer.signal back to", callerId);
            socket.emit("returning-signal", { signal, callerId });
        });
        peer.signal(incomingSignal);
        peer.on("stream", (s) => {
            console.log("🖥️ addPeer.stream from", callerId);
            setRemoteStreams((p) => ({ ...p, [callerId]: s }));
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
        router.push("/home");
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
