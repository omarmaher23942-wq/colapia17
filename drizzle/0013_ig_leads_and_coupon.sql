CREATE TABLE "ig_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"brand_name" text,
	"category" text,
	"note" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"message" text,
	"message_source" text,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"conversation_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_payments" ADD COLUMN "coupon" text;--> statement-breakpoint
ALTER TABLE "ig_leads" ADD CONSTRAINT "ig_leads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ig_leads_handle_uq" ON "ig_leads" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "ig_leads_status_sched_idx" ON "ig_leads" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "ig_leads_conv_idx" ON "ig_leads" USING btree ("conversation_id");