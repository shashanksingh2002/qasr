"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Peer, { SignalData } from "simple-peer";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Monitor, LogOut, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface SignalPayload {
    signal: SignalData;
    callerId: string;
}

interface UserJoinedRoomPayload {
    userId: string;
    userName: string;
}

const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
    transports: ["websocket"]
});

const POKEMON_NAMES = [
    "Pikachu", "Charmander", "Bulbasaur", "Squirtle", "Jigglypuff",
    "Meowth", "Psyduck", "Snorlax", "Gengar", "Eevee",
    "Vulpix", "Machop", "Gastly", "Onix", "Lapras"
];

function getRandomPokemon(): string {
    return POKEMON_NAMES[Math.floor(Math.random() * POKEMON_NAMES.length)];
}

export default function RoomPage() {
    const { id: roomId } = useParams();
    const router = useRouter();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [userNames, setUserNames] = useState<Record<string, string>>({});
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<string[]>([]);
    const peersRef = useRef<Record<string, Peer.Instance>>({});

    useEffect(() => {
        (async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            const localVideo = document.getElementById("local-video") as HTMLVideoElement;
            if (localVideo) localVideo.srcObject = stream;
        })();
    }, []);

    useEffect(() => {
        if (!localStream) return;

        socket.emit("join-room", roomId);
        console.log(`[SOCKET] Joined room: ${roomId}`);

        socket.on("all-users", (users: string[]) => {
            console.log("[SOCKET] Received list of users in room:", users);
            users.forEach((userId) => {
                const peer = createPeer(userId, socket.id!, localStream);
                peersRef.current[userId] = peer;
                setUserNames((prev) => ({ ...prev, [userId]: getRandomPokemon() }));
            });
        });

        socket.on("user-joined", ({ signal, callerId }: SignalPayload) => {
            console.log("[SOCKET] Received offer from:", callerId);
            const peer = addPeer(signal, callerId, localStream);
            peersRef.current[callerId] = peer;
            setUserNames((prev) => ({ ...prev, [callerId]: getRandomPokemon() }));

            peer.on("signal", (signal) => {
                socket.emit("returning-signal", { signal, callerId });
            });
        });

        socket.on("receiving-returned-signal", ({ signal, id }: { signal: SignalData; id: string }) => {
            console.log("[SOCKET] Received answer from:", id);
            const peer = peersRef.current[id];
            peer?.signal(signal);
        });

        socket.on("chat-message", (message: string) => {
            console.log("[CHAT] Message received:", message);
            setChatMessages((prev) => [...prev, message]);
        });

        socket.on("user-joined-room", ({ userId, userName }: UserJoinedRoomPayload) => {
            console.log(`[EVENT] ${userName} (${userId}) joined the room`);
            toast(`${userName} joined the meeting`);
        });

        socket.on("user-left", (socketId: string) => {
            console.log(`[EVENT] User left: ${socketId}`);
            const name = userNames[socketId] || "Someone";
            toast(`${name} left the meeting`);

            setRemoteStreams((prev) => {
                const updated = { ...prev };
                delete updated[socketId];
                return updated;
            });

            setUserNames((prev) => {
                const updated = { ...prev };
                delete updated[socketId];
                return updated;
            });

            if (peersRef.current[socketId]) {
                peersRef.current[socketId].destroy();
                delete peersRef.current[socketId];
            }
        });

        return () => {
            socket.off("all-users");
            socket.off("user-joined");
            socket.off("receiving-returned-signal");
            socket.off("chat-message");
            socket.off("user-joined-room");
            socket.off("user-left");
        };
    }, [localStream]);

    const createPeer = (userToSignal: string, callerId: string, stream: MediaStream): Peer.Instance => {
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peer.on("signal", (signal: SignalData) => {
            socket.emit("sending-signal", { userToSignal, callerId, signal });
        });
        peer.on("stream", (stream: MediaStream) => {
            console.log("[WEBRTC] Received remote stream from:", userToSignal);
            setRemoteStreams((prev) => ({ ...prev, [userToSignal]: stream }));
        });
        return peer;
    };

    const addPeer = (incomingSignal: SignalData, callerId: string, stream: MediaStream): Peer.Instance => {
        const peer = new Peer({ initiator: false, trickle: false, stream });
        peer.on("signal", (signal: SignalData) => {
            socket.emit("returning-signal", { signal, callerId });
        });
        peer.signal(incomingSignal);
        peer.on("stream", (stream: MediaStream) => {
            console.log("[WEBRTC] Received remote stream from:", callerId);
            setRemoteStreams((prev) => ({ ...prev, [callerId]: stream }));
        });
        return peer;
    };

    const toggleVideo = () => {
        if (!localStream) return;
        const track = localStream.getVideoTracks()[0];
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
    };

    const toggleAudio = () => {
        if (!localStream) return;
        const track = localStream.getAudioTracks()[0];
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
    };

    const handleScreenShare = async () => {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        for (const peer of Object.values(peersRef.current)) {
            const sender = peer.streams[0]?.getVideoTracks()[0];
            if (sender) peer.replaceTrack(sender, screenTrack, peer.streams[0]);
        }
    };

    const handleLeave = () => {
        Object.values(peersRef.current).forEach((peer) => peer.destroy());
        peersRef.current = {};
        socket.disconnect();
        router.push("/home");
    };

    const toggleChat = () => setIsChatOpen((prev) => !prev);

    const sendMessage = (msg: string) => {
        socket.emit("chat-message", msg);
        setChatMessages((prev) => [...prev, `You: ${msg}`]);
    };

    const allParticipants = [
        { id: "local", stream: localStream, name: "You" },
        ...Object.entries(remoteStreams).map(([id, stream]) => ({
            id,
            stream,
            name: userNames[id] || id,
        })),
    ];

    return (
        <div className="relative h-screen w-screen bg-black text-white">
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-4`}>
                {allParticipants.map(({ id, stream, name }) => (
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

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 p-4 bg-white/10 rounded-xl backdrop-blur">
                <Button variant="ghost" size="icon" onClick={toggleVideo}>
                    {isVideoEnabled ? <Video /> : <VideoOff />}
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleAudio}>
                    {isAudioEnabled ? <Mic /> : <MicOff />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleScreenShare}>
                    <Monitor />
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleChat}>
                    <MessageSquare />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLeave}>
                    <LogOut />
                </Button>
            </div>

            {isChatOpen && (
                <div className="absolute top-0 right-0 w-64 h-full bg-white text-black p-4 shadow-lg">
                    <h3 className="font-semibold mb-2">Chat</h3>
                    <div className="h-[80%] overflow-y-scroll mb-2">
                        {chatMessages.map((msg, i) => (
                            <div key={i} className="text-sm my-1">{msg}</div>
                        ))}
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const input = e.currentTarget.elements.namedItem("msg") as HTMLInputElement;
                            const value = input.value.trim();
                            if (value) sendMessage(value);
                            input.value = "";
                        }}
                        className="flex gap-2"
                    >
                        <input name="msg" className="flex-1 border px-2 py-1 text-sm" />
                        <Button type="submit" size="sm">
                            Send
                        </Button>
                    </form>
                </div>
            )}
        </div>
    );
}
