'use client';

import { useSession, signOut } from "next-auth/react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import VideosTab from "./components/my-recordings";
import CreateRoomTab from "./components/create-room";
import JoinRoomTab from "./components/join-room";
import Image from "next/image";

export default function Home() {
  const { data: session, status } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/signin" });
    toast.success("Logged out successfully");
  };

  if (status === "loading") return <p>Loading...</p>;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-black text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Qasr</h1>
        <div className="flex items-center space-x-4">
          <Popover>
            <PopoverTrigger>
              <Image
                width={10}
                height={10}
                src={session?.user?.image || '/default-avatar.png'}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover cursor-pointer"
              />
            </PopoverTrigger>
            <PopoverContent className="p-4 bg-white text-black rounded-lg shadow-lg">
              <Button
                onClick={handleLogout}
                className="bg-black text-white py-2 px-4 rounded-md"
              >
                Logout
              </Button>
            </PopoverContent>
          </Popover>
          <span>{session?.user?.name}</span>
        </div>
      </header>

      <div className="p-8">
        <h2 className="text-2xl font-semibold mb-4">Welcome to Qasr!</h2>
        <p className="mb-6">Your real-time video meetings platform.</p>

        <Tabs defaultValue="recordings" className="w-full max-w-xl">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-transparent border rounded-md overflow-hidden">
            <TabsTrigger
              value="recordings"
              className="data-[state=active]:bg-black data-[state=active]:text-white text-black"
            >
              My Recordings
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="data-[state=active]:bg-black data-[state=active]:text-white text-black"
            >
              Create Room
            </TabsTrigger>
            <TabsTrigger
              value="join"
              className="data-[state=active]:bg-black data-[state=active]:text-white text-black"
            >
              Join Room
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recordings">
            <VideosTab />
          </TabsContent>

          <TabsContent value="create">
            <CreateRoomTab />
          </TabsContent>

          <TabsContent value="join">
            <JoinRoomTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
