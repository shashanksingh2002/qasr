import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { db } from "./db";
import { Users } from "@/db/schema/users";
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
      const existingUser = await db
        .select()
        .from(Users)
        .where(eq(Users.email, user.email!))
        .execute();

      if (existingUser.length === 0) {
        await db
          .insert(Users)
          .values({
            name: user.name,
            email: user.email!,
            avatar: user.image,
          })
          .execute();
      }

      return true;
    },
    async session({ session }: any) {
      return session;
    },
  },
};
