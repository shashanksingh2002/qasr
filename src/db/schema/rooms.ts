import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const Rooms = pgTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    name: text("name"),
    roomId: varchar("room_id", { length: 9 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
  },
  (table) => [uniqueIndex("unique_room_id").on(table.roomId)]
);