CREATE TABLE "client_briefs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"kind" text DEFAULT 'realestate' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"email" text,
	"data" jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "client_briefs_ref_uq" ON "client_briefs" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "client_briefs_created_idx" ON "client_briefs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "client_briefs_status_idx" ON "client_briefs" USING btree ("status","created_at");