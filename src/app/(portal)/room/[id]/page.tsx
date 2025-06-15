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

interface SignalPayload { signal: SignalData; callerId: string; }
interface AllUsersPayload { userId: string; userName: string; }
interface UserJoinedRoomPayload { userId: string; userName: string; }

export default function RoomPage() {
    const params = useParams();
    const roomId = params?.id as string | undefined;
    const router = useRouter();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [userNames, setUserNames] = useState<Record<string, string>>({});
    const [chatMessages, setChatMessages] = useState<string[]>([]);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const peersRef = useRef<Record<string, Peer.Instance>>({});
    const socketRef = useRef<Socket | undefined>(undefined);

    // 1) getUserMedia
    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                console.log("🎥 got local media stream");
                setLocalStream(stream);
            })
            .catch(err => console.error("🔴 getUserMedia failed:", err));
    }, []);

    // 2) build socket once localStream is ready
    useEffect(() => {
        if (!localStream) return;
        if (socketRef.current) return;          

        const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL!;
        const socket = io(SOCKET_URL, {
            path: "/socket.io",
            transports: ["polling"],              // skip polling entirely
            withCredentials: true,
            autoConnect: false,                     // we’ll connect manually
        });
        socket.on("connect", () => console.log("✅ Client‐side socket connected as", socket.id));
        socket.on("connect_error", (err) => console.error("❌ Client connect_error:", err));
        socket.on("disconnect", (reason) => console.warn("⚠️ Client disconnected:", reason));
        socketRef.current = socket;

        // debug logs
        socket.onAny((e, ...args) => console.log("⬅️ Client got event:", e, args));
        socket.on("connect_error", err => console.error("❌ connect_error:", err));
        socket.io.on("error", err => console.error("❌ engine error:", err));

        // once connected, join
        socket.once("connect", () => {
            console.log("✅ Socket connected:", socket.id);
            socket.emit("join-room", roomId);
        });

        // if for some reason already connected (hot reload), emit immediately
        if (socket.connected) {
            console.log("🔗 already connected; joining:", roomId);
            socket.emit("join-room", roomId);
        }

        // handle all-users
        socket.on("all-users", (users: AllUsersPayload[]) => {
            console.log("👥 all-users:", users);
            users.forEach(({ userId, userName }) => {
                const peer = new Peer({ initiator: true, trickle: false, stream: localStream });
                peer.on("signal", s => socket.emit("sending-signal", { userToSignal: userId, callerId: socket.id, signal: s }));
                peer.on("stream", s => setRemoteStreams(p => ({ ...p, [userId]: s })));
                peersRef.current[userId] = peer;
                setUserNames(p => ({ ...p, [userId]: userName }));
            });
        });

        socket.on("user-joined", ({ signal, callerId }: SignalPayload) => {
            const peer = new Peer({ initiator: false, trickle: false, stream: localStream });
            peer.on("signal", s => socket.emit("returning-signal", { signal: s, callerId }));
            peer.signal(signal);
            peer.on("stream", s => setRemoteStreams(p => ({ ...p, [callerId]: s })));
            peersRef.current[callerId] = peer;
        });

        socket.on("receiving-returned-signal", ({ signal, id }: { signal: SignalData; id: string }) => {
            peersRef.current[id]?.signal(signal);
        });

        socket.on("user-joined-room", ({ userId, userName }: UserJoinedRoomPayload) => {
            setUserNames(p => ({ ...p, [userId]: userName }));
            toast.success(`${userName} joined`);
        });

        socket.on("user-left", sid => {
            setRemoteStreams(p => { const c = { ...p }; delete c[sid]; return c; });
            setUserNames(p => { const c = { ...p }; delete c[sid]; return c; });
            peersRef.current[sid]?.destroy();
            delete peersRef.current[sid];
            toast(`User left`);
        });

        socket.on("chat-message", msg => {
            setChatMessages(p => [...p, msg]);
        });

        // now actually connect
        console.log("🔗 Starting socket connection");
        socket.connect();

        return () => {
            socketRef.current?.disconnect();
            socketRef.current = undefined;
        };
    }, [localStream, roomId]);

    // ─── UI control handlers & JSX (unchanged) ────────────────────────────────
    const toggleVideo = () => {
        if (!localStream) return;
        const t = localStream.getVideoTracks()[0];
        t.enabled = !t.enabled;
        setIsVideoOn(t.enabled);
    };
    const toggleAudio = () => {
        if (!localStream) return;
        const t = localStream.getAudioTracks()[0];
        t.enabled = !t.enabled;
        setIsAudioOn(t.enabled);
    };
    const shareScreen = async () => {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = screen.getVideoTracks()[0];
        Object.values(peersRef.current).forEach(peer => {
            const old = localStream?.getVideoTracks()[0];
            if (old && localStream) peer.replaceTrack(old, track, localStream);
        });
    };
    const leaveMeeting = () => {
        console.log("👋 Leaving meeting");
        Object.values(peersRef.current).forEach(p => p.destroy());
        peersRef.current = {};
        socketRef.current?.disconnect();
        router.push("/home");
    };
    const sendChat = (m: string) => {
        console.log("🚀 Sending chat:", m);
        socketRef.current?.emit("chat-message", m);
        setChatMessages(p => [...p, `You: ${m}`]);
    };

    const participants = [
        { id: "local", stream: localStream, name: "You" },
        ...Object.entries(remoteStreams).map(([id, stream]) => ({ id, stream, name: userNames[id] || id })),
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
