CREATE TABLE "economy_events" (
	"id" serial PRIMARY KEY,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"volume_delta" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY,
	"token_value" integer NOT NULL,
	"volume_delta" integer DEFAULT 0 NOT NULL,
	"reason" text DEFAULT 'aggregate_ingestion' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "unique_price" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "alt_account" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "listed_at" timestamp;