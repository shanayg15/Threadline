DROP INDEX "integrations_brand_kind_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_brand_kind_uq" ON "integrations" USING btree ("brand_id","kind");