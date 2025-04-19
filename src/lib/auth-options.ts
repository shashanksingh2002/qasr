import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { db } from "./db";
import { Users as users } from "@/db/schema/users";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
    //   const existing = await db.query.users.findFirst({
    //     where: eq(users.email, user.email!),
    //   });

    //   if (!existing) {
    //     await db.insert(users).values({
    //       name: user.name ?? "",
    //       email: user.email!,
    //       image: user.image ?? "",
    //     });
    //   }

      return true;
    },
    async session({ session }) {
      // Add user id or extra info if needed
      return session;
    },
  },
};
