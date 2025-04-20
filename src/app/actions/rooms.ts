"use server";

import { db } from "@/lib/db";
import { Rooms } from "@/db/schema/rooms";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid"
import slugify from "slugify"
import { eq, sql } from "drizzle-orm";

export async function createRoom(formData: FormData) {
    const session = await getServerSession();

    if (!session?.user?.email) {
        throw new Error("Unauthorized");
    }

    const name = formData.get("name")?.toString() || "";
    const createdBy = session.user.email;
    const roomId = nanoid(9);
    const slug = slugify(name, { lower: true, strict: true });
    
    await db.insert(Rooms).values({
        name: slug,
        createdBy,
        roomId,
    });

    return roomId;
}

interface GetRoomsParams {
  page: number;
  limit: number;
}

export async function getUserRooms({ page, limit }: GetRoomsParams) {
    const session = await getServerSession();

    if (!session?.user?.email) {
      throw new Error("Unauthorized");
    }

    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(Rooms)
        .where(eq(Rooms.createdBy, session.user.email))
        .orderBy(Rooms.createdAt)
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(Rooms)
        .where(eq(Rooms.createdBy, session.user.email)),
    ]);

    const total = countResult[0]?.count ?? 0;

    return { data, total };
}