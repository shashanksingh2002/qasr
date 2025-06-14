"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getUserRooms } from "@/app/actions/rooms";

interface RoomTypes {
  name: string | null;
  id: number;
  roomId: string;
  createdAt: Date;
  createdBy: string;
}

export default function JoinRoomTab() {
  const [roomCode, setRoomCode] = useState("");
  const [rooms, setRooms] = useState<RoomTypes[]>([]);
  const [page, setPage] = useState(1);
  const limit = 5;
  const [totalPages, setTotalPages] = useState(1);
  const router = useRouter();

  const handleJoinRoom = () => {
    if (!roomCode) return toast.error("Please enter a valid room code");
    router.push(`/room/${roomCode}`);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data, total } = await getUserRooms({ page, limit });
        setRooms(data);
        setTotalPages(Math.ceil(total / limit));
      } catch {
        toast.error("Failed to load your rooms");
      }
    })();
  }, [page]);

  return (
    <div className="space-y-6">
      <Input
        placeholder="Enter Room Code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
      />
      <Button onClick={handleJoinRoom}>Join Room</Button>
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Your Rooms</h3>
        {rooms.map((room) => (
          <div key={room.id} className="flex justify-between items-center mb-2">
            <div>
              {room.name} <span className="text-muted-foreground">({room.roomId})</span>
            </div>
            <Button onClick={() => router.push(`/room/${room.roomId}`)}>Join</Button>
          </div>
        ))}
        <div className="flex justify-center items-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="px-3 py-1 text-sm">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
