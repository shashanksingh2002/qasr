import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const Users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
});
