-- استمارة واحدة لكل متجر بدل كل محادثة: يمنع بناء متجر ببيانات استمارة متجر آخر لنفس التاجر.
DROP INDEX IF EXISTS "intakes_conv_uq";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "intakes_store_uq" ON "intakes" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intakes_conv_idx" ON "intakes" USING btree ("conversation_id");
