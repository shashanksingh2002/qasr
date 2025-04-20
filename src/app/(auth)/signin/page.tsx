"use client"

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SignIn() {
  return (
    <div className="flex min-h-screen">
      {/* Left side: Cool background with pointers */}
      <div className="w-1/2 bg-gradient-to-r from-blue-500 to-indigo-700 text-white flex flex-col justify-center items-center">
        <h2 className="text-3xl font-semibold mb-4 text-center">Welcome to Qasr</h2>
        <p className="text-xl mb-6 text-center">The next-gen meeting platform.</p>

        <ul className="space-y-4">
          <li>✔️ Real-time video meetings</li>
          <li>✔️ Live recording & multi-resolution</li>
          <li>✔️ High scalability for teams</li>
          <li>✔️ Cloud-backed storage for all sessions</li>
        </ul>
      </div>

      {/* Right side: Login Section */}
      <div className="w-1/2 bg-white flex flex-col justify-center items-center py-12 px-6">
        <h1 className="text-4xl font-bold text-center mb-6">Qasr</h1>
        <p className="text-lg text-center mb-4">Your video meetings, reimagined</p>

        <Button
          onClick={() => signIn("github", { callbackUrl: "/home" })}
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700"
        >
          Login with GitHub
        </Button>
      </div>
    </div>
  );
}
