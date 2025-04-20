"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createRoom } from "@/app/actions/rooms";

export default function CreateRoomTab() {
  const [isPending, startTransition] = useTransition();
  const [roomId, setRoomId] = useState<string>("");

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      try {
        const id: string = await createRoom(formData);
        setRoomId(id);
        toast.success("Room Created Successfully");
      } catch (err) {
        toast.error("Failed to create room");
      }
    });
  };

  return (
    <>
      <form action={handleSubmit}>
        <Input
          name="name"
          type="text"
          placeholder="Enter Room Name"
          className="w-full mb-4"
          required
        />
        <Button
          type="submit"
          disabled={isPending}
          className="bg-black text-white py-2 px-6 rounded-md"
        >
          {isPending ? "Creating..." : "Create Meeting Room"}
        </Button>
      </form>

      {roomId && (
        <div className="mt-4 p-4 border rounded-md bg-white">
          <p className="text-sm text-gray-700">Room ID:</p>
          <p className="text-lg font-mono font-semibold text-black">{roomId}</p>
        </div>
      )}
    </>
  );
}
