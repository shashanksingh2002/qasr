"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Monitor, LogOut, MessageSquare } from "lucide-react";

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!);

const POKEMON_NAMES = [
    "Pikachu", "Charmander", "Bulbasaur", "Squirtle", "Jigglypuff",
    "Meowth", "Psyduck", "Snorlax", "Gengar", "Eevee",
    "Vulpix", "Machop", "Gastly", "Onix", "Lapras"
];

function getRandomPokemon() {
    return POKEMON_NAMES[Math.floor(Math.random() * POKEMON_NAMES.length)];
}

export default function RoomPage() {
    const { id: roomId } = useParams();
    const router = useRouter();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
    const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const peersRef = useRef<{ [key: string]: Peer.Instance }>({});

    useEffect(() => {
        (async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);

            const localVideo = document.getElementById("local-video") as HTMLVideoElement;
            if (localVideo) localVideo.srcObject = stream;

            socket.emit("join-room", roomId);
        })();
    }, [roomId]);

    useEffect(() => {
        socket.on("all-users", (users: string[]) => {
            users.forEach((userId) => {
                const peer = createPeer(userId, socket.id as string, localStream);
                peersRef.current[userId] = peer;
                setUserNames((prev) => ({ ...prev, [userId]: getRandomPokemon() }));
            });
        });

        socket.on("user-joined", (payload) => {
            const peer = addPeer(payload.signal, payload.callerId, localStream);
            peersRef.current[payload.callerId] = peer;
            setUserNames((prev) => ({ ...prev, [payload.callerId]: getRandomPokemon() }));
        });

        socket.on("receiving-returned-signal", (payload) => {
            const peer = peersRef.current[payload.id];
            peer?.signal(payload.signal);
        });
    }, [localStream]);

    const createPeer = (userToSignal: string, callerId: string, stream: MediaStream | null) => {
        const peer = new Peer({ initiator: true, trickle: false, stream: stream ?? undefined });
        peer.on("signal", (signal) => {
            socket.emit("sending-signal", { userToSignal, callerId, signal });
        });
        peer.on("stream", (stream) => {
            setRemoteStreams((prev) => ({ ...prev, [userToSignal]: stream }));
        });
        return peer;
    };

    const addPeer = (incomingSignal: any, callerId: string, stream: MediaStream | null) => {
        const peer = new Peer({ initiator: false, trickle: false, stream: stream ?? undefined });
        peer.on("signal", (signal) => {
            socket.emit("returning-signal", { signal, callerId });
        });
        peer.signal(incomingSignal);
        peer.on("stream", (stream) => {
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
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = localStream?.getVideoTracks()[0];
        if (sender && localStream) {
            localStream.removeTrack(sender);
            localStream.addTrack(videoTrack);
        }
    };

    const handleLeave = () => {
        socket.disconnect();
        router.push("/home");
    };

    const toggleChat = () => setIsChatOpen((prev) => !prev);

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
                    <h3 className="font-semibold mb-2">Chat (coming soon)</h3>
                    <div className="text-sm text-muted-foreground">Chat UI placeholder</div>
                </div>
            )}
        </div>
    );
}
