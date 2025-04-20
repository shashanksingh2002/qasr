CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"room_id" varchar(9) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "unique_room_id" ON "rooms" USING btree ("room_id");