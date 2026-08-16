CREATE TABLE "orders" (
	"id" serial PRIMARY KEY,
	"hash" text NOT NULL UNIQUE,
	"ign" text NOT NULL,
	"order_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"amount" integer NOT NULL,
	"settled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);
