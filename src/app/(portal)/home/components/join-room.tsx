"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { getUserRooms } from "@/app/actions/rooms";

interface RoomTypes {
    name: string | null,
    id: number,
    roomId: string,
    createdAt: Date,
    createdBy: string,
}

export default function JoinRoomTab() {
  const [roomCode, setRoomCode] = useState("");
  const [rooms, setRooms] = useState<RoomTypes[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 5;
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, total } = await getUserRooms({ page, limit });
        setRooms(data);
        setTotalPages(Math.ceil(total / limit));
      } catch {
        toast.error("Failed to load your rooms");
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const handleJoinRoom = () => {
    if (roomCode) {
      toast.success(`Joining room with code: ${roomCode}`);
    } else {
      toast.error("Please enter a valid room code.");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <Input
          type="text"
          placeholder="Enter Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          className="w-full mb-4"
        />
        <Button
          onClick={handleJoinRoom}
          className="bg-black text-white py-2 px-6 rounded-md"
        >
          Join a Meeting Room
        </Button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Your Rooms</h3>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading rooms...</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Room Code</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell>{room.name}</TableCell>
                    <TableCell className="font-mono">{room.roomId}</TableCell>
                    <TableCell>{new Date(room.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-center align-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-sm">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
