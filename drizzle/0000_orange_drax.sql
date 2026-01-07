CREATE TABLE "items" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"rarity" varchar(20) NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"icon" text,
	"vendor_value" integer DEFAULT 0 NOT NULL,
	"chat_link" varchar(50),
	"flags" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"item_id" integer PRIMARY KEY NOT NULL,
	"buy_price" integer DEFAULT 0 NOT NULL,
	"buy_quantity" integer DEFAULT 0 NOT NULL,
	"sell_price" integer DEFAULT 0 NOT NULL,
	"sell_quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" integer PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"output_item_id" integer NOT NULL,
	"output_item_count" integer DEFAULT 1 NOT NULL,
	"min_rating" integer DEFAULT 0 NOT NULL,
	"time_to_craft" integer DEFAULT 0 NOT NULL,
	"disciplines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"guild_ingredients" jsonb DEFAULT '[]'::jsonb,
	"chat_link" varchar(50),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "items_name_idx" ON "items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "items_type_idx" ON "items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "items_rarity_idx" ON "items" USING btree ("rarity");--> statement-breakpoint
CREATE INDEX "recipes_output_item_id_idx" ON "recipes" USING btree ("output_item_id");--> statement-breakpoint
CREATE INDEX "recipes_type_idx" ON "recipes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "recipes_min_rating_idx" ON "recipes" USING btree ("min_rating");