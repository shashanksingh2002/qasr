"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Peer, { SignalData } from "simple-peer";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Monitor, LogOut, MessageSquare } from "lucide-react";
import { toast } from "sonner";

// Socket.IO client
const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
    transports: ["websocket"],
    withCredentials: true,
});

interface SignalPayload {
    signal: SignalData;
    callerId: string;
}

interface JoinedPayload {
    userId: string;
    userName: string;
}

const POKEMON = ["Pikachu", "Charmander", "Bulbasaur", "Squirtle", "Jigglypuff", "Meowth", "Psyduck", "Snorlax", "Gengar", "Eevee", "Vulpix", "Machop", "Gastly", "Onix", "Lapras"];

function randomName(): string {
    return POKEMON[Math.floor(Math.random() * POKEMON.length)];
}

export default function RoomPage() {
    const { id: roomId } = useParams();
    const router = useRouter();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [userNames, setUserNames] = useState<Record<string, string>>({});
    const [chatMessages, setChatMessages] = useState<string[]>([]);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const peersRef = useRef<Record<string, Peer.Instance>>({});

    // Get local media
    useEffect(() => {
        (async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            const vid = document.getElementById("local-video") as HTMLVideoElement;
            if (vid) vid.srcObject = stream;
        })();
    }, []);

    // Handle signaling events
    useEffect(() => {
        if (!localStream) return;

        socket.emit("join-room", roomId);
        console.log("[SOCKET] join-room", roomId);

        socket.on("all-users", (users: string[]) => {
            console.log("[SOCKET] all-users", users);
            users.forEach((userId) => {
                if (!socket.id) return; // Ensure socket.id is defined
                const peer = createPeer(userId, socket.id, localStream);
                peersRef.current[userId] = peer;
                setUserNames((u) => ({ ...u, [userId]: randomName() }));
            });
        });

        socket.on("user-joined", ({ signal, callerId }: SignalPayload) => {
            console.log("[SOCKET] user-joined", callerId);
            const peer = addPeer(signal, callerId, localStream);
            peersRef.current[callerId] = peer;
            setUserNames((u) => ({ ...u, [callerId]: randomName() }));
        });

        socket.on("receiving-returned-signal", ({ signal, id }: { signal: SignalData; id: string }) => {
            console.log("[SOCKET] receiving-returned-signal", id);
            const peer = peersRef.current[id];
            peer?.signal(signal);
        });

        socket.on("chat-message", (msg: string) => {
            console.log("[CHAT]", msg);
            setChatMessages((c) => [...c, msg]);
        });

        socket.on("user-joined-room", ({ userName }: JoinedPayload) => {
            toast.success(`${userName} joined the meeting`);
        });

        socket.on("user-left", (sid: string) => {
            const name = userNames[sid] ?? "Someone";
            toast(`${name} left`);
            setRemoteStreams((s) => { const copies = { ...s }; delete copies[sid]; return copies; });
            setUserNames((u) => { const copies = { ...u }; delete copies[sid]; return copies; });
            peersRef.current[sid]?.destroy();
            delete peersRef.current[sid];
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

    // Peer constructors
    const createPeer = (userToSignal: string, callerId: string, stream: MediaStream) => {
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peer.on("signal", (signal) => {
            socket.emit("sending-signal", { userToSignal, callerId, signal });
        });
        peer.on("stream", (s) => setRemoteStreams((rs) => ({ ...rs, [userToSignal]: s })));
        return peer;
    };

    const addPeer = (incomingSignal: SignalData, callerId: string, stream: MediaStream) => {
        const peer = new Peer({ initiator: false, trickle: false, stream });
        peer.on("signal", (signal) => socket.emit("returning-signal", { signal, callerId }));
        peer.signal(incomingSignal);
        peer.on("stream", (s) => setRemoteStreams((rs) => ({ ...rs, [callerId]: s })));
        return peer;
    };

    // UI control handlers
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
        if (!localStream) return;
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const newTrack = ss.getVideoTracks()[0];
        const oldTrack = localStream.getVideoTracks()[0];
        for (const peer of Object.values(peersRef.current)) {
            peer.replaceTrack(oldTrack, newTrack, localStream);
        }
        localStream.removeTrack(oldTrack);
        localStream.addTrack(newTrack);
    };

    const leaveMeeting = () => {
        Object.values(peersRef.current).forEach((p) => p.destroy());
        peersRef.current = {};
        socket.disconnect();
        router.push("/");
    };

    const sendChat = (msg: string) => {
        socket.emit("chat-message", msg);
        setChatMessages((c) => [...c, `You: ${msg}`]);
    };

    // Render participants
    const participants = [
        { id: "local", stream: localStream, name: "You" },
        ...Object.entries(remoteStreams).map(([id, stream]) => ({ id, stream, name: userNames[id] ?? id })),
    ];

    return (
        <div className="relative h-screen w-screen bg-black text-white">
            {/* Video Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-4">
                {participants.map(({ id, stream, name }) => (
                    <div key={id} className="relative">
                        <video
                            id={id === "local" ? "local-video" : `remote-${id}`}
                            autoPlay playsInline muted={id === "local"}
                            className="rounded w-full h-full object-cover"
                            ref={el => { if (el && stream) el.srcObject = stream; }}
                        />
                        <div className="absolute bottom-1 left-1 right-1 text-center bg-black/50 text-xs py-1 rounded">
                            {name}
                        </div>
                    </div>
                ))}
            </div>
            {/* Control Bar */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-lg">
                <Button onClick={toggleVideo} variant="ghost" size="icon">{isVideoOn ? <Video /> : <VideoOff />}</Button>
                <Button onClick={toggleAudio} variant="ghost" size="icon">{isAudioOn ? <Mic /> : <MicOff />}</Button>
                <Button onClick={shareScreen} variant="ghost" size="icon"><Monitor /></Button>
                <Button onClick={() => setIsChatOpen(c => !c)} variant="ghost" size="icon"><MessageSquare /></Button>
                <Button onClick={leaveMeeting} variant="ghost" size="icon"><LogOut /></Button>
            </div>
            {/* Chat Drawer */}
            {isChatOpen && (
                <div className="absolute top-0 right-0 w-64 h-full bg-white text-black p-4 shadow-lg">
                    <h3 className="font-semibold mb-2">Chat</h3>
                    <div className="flex-1 overflow-y-auto mb-2">
                        {chatMessages.map((m, i) => <p key={i} className="text-sm my-1">{m}</p>)}
                    </div>
                    <form onSubmit={e => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem("msg") as HTMLInputElement).value.trim(); if (v) sendChat(v); e.currentTarget.reset(); }} className="flex gap-2">
                        <input name="msg" className="flex-1 border p-2 text-sm" />
                        <Button type="submit" size="sm">Send</Button>
                    </form>
                </div>
            )}
        </div>
    );
}
