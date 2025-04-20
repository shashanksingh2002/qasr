'use client';

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Github } from "lucide-react";
import { useState } from "react";

export default function SignIn() {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    const response = await signIn("github", { callbackUrl: "/home" });

    if (response?.error) {
      toast.error("Login failed. Please try again.");
      setIsLoading(false);
    } else {
      toast.success("Login successful! Redirecting...");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="w-1/2 bg-black text-white flex flex-col justify-center items-center">
        <h2 className="text-3xl font-semibold mb-4 text-center">Welcome to Qasr</h2>
        <p className="text-xl mb-6 text-center">The next-gen meeting platform.</p>

        <ul className="space-y-4">
          <li>✔️ Real-time video meetings</li>
          <li>✔️ Live recording & multi-resolution</li>
          <li>✔️ High scalability for teams</li>
          <li>✔️ Cloud-backed storage for all sessions</li>
        </ul>
      </div>

      <div className="w-1/2 bg-white flex flex-col justify-center items-center py-12 px-6">
        <h1 className="text-4xl font-bold text-center mb-6">Qasr</h1>
        <p className="text-lg text-center mb-4">Your video meetings, reimagined</p>

        <Button
          onClick={handleSignIn}
          className={`bg-black text-white font-semibold py-2 rounded-lg hover:bg-gray-700 ${
            isLoading ? "cursor-wait" : "cursor-pointer"
          }`}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="animate-spin border-t-4 border-white border-solid w-6 h-6 rounded-full mr-2" />
          ) : (
            <Github className="mr-2" />
          )}
          Login with GitHub
        </Button>
      </div>
    </div>
  );
}
