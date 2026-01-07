CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"buy_price" integer NOT NULL,
	"buy_quantity" integer NOT NULL,
	"sell_price" integer NOT NULL,
	"sell_quantity" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "price_history_item_id_idx" ON "price_history" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "price_history_recorded_at_idx" ON "price_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "price_history_item_time_idx" ON "price_history" USING btree ("item_id","recorded_at");