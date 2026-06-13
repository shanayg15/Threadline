CREATE TYPE "public"."assignee_type" AS ENUM('ai', 'human');--> statement-breakpoint
CREATE TYPE "public"."audit_actor" AS ENUM('ai', 'human', 'system');--> statement-breakpoint
CREATE TYPE "public"."consent_action" AS ENUM('opt_in', 'opt_out', 'help', 'start');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('opted_in', 'opted_out', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."conversation_channel" AS ENUM('sms', 'mms', 'rcs', 'whatsapp', 'imessage');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('automated', 'escalated', 'blocked', 'closed');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'received');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('order_created', 'order_fulfilled', 'order_delivered', 'payment_failed', 'no_response');--> statement-breakpoint
CREATE TYPE "public"."experiment_group" AS ENUM('treatment', 'control');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_status" AS ENUM('unfulfilled', 'fulfilled', 'partial');--> statement-breakpoint
CREATE TYPE "public"."integration_kind" AS ENUM('shopify', 'twilio', 'slack', 'easypost', 'langfuse');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'error', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('catalog', 'policy');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_sender" AS ENUM('customer', 'ai', 'human');--> statement-breakpoint
CREATE TYPE "public"."pending_action_status" AS ENUM('pending', 'confirmed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."pending_action_type" AS ENUM('place_order', 'create_exchange', 'modify_subscription', 'create_checkout_link');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'agent', 'viewer');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"voice_config" jsonb,
	"policies" jsonb,
	"quiet_hours" jsonb,
	"frequency_caps" jsonb,
	"supervised_mode" boolean DEFAULT true NOT NULL,
	"channel_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"kind" "integration_kind" NOT NULL,
	"credentials_ciphertext" text,
	"status" "integration_status" DEFAULT 'disconnected' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"shopify_customer_id" text,
	"phone_e164" text NOT NULL,
	"name" text,
	"email" text,
	"consent_status" "consent_status" DEFAULT 'unknown' NOT NULL,
	"consent_source" text,
	"consent_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"experiment_group" "experiment_group",
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"shopify_variant_id" text,
	"title" text,
	"sku" text,
	"price_cents" integer,
	"inventory_qty" integer,
	"options" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"shopify_product_id" text,
	"title" text NOT NULL,
	"description" text,
	"fit_notes" text,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"variant_id" uuid,
	"title" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"price_cents" integer
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"shopify_order_id" text,
	"status" text,
	"total_cents" integer,
	"fulfillment_status" "fulfillment_status" DEFAULT 'unfulfilled' NOT NULL,
	"tracking_number" text,
	"carrier" text,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"attributed_conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"channel" "conversation_channel" DEFAULT 'sms' NOT NULL,
	"status" "conversation_status" DEFAULT 'automated' NOT NULL,
	"assignee_type" "assignee_type" DEFAULT 'ai' NOT NULL,
	"assignee_user_id" uuid,
	"paused" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"sender" "message_sender" NOT NULL,
	"body" text,
	"media_urls" jsonb,
	"channel_message_id" text,
	"delivery_status" "delivery_status",
	"cost_cents" integer,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"type" "pending_action_type" NOT NULL,
	"payload" jsonb,
	"status" "pending_action_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"customer_id" uuid,
	"type" "event_type" NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "playbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"key" text NOT NULL,
	"trigger_type" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"prompt_template" text,
	"delay_minutes" integer,
	"frequency_cap" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"source_type" "knowledge_source_type" NOT NULL,
	"ref_id" uuid,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"actor" "audit_actor" NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"customer_id" uuid,
	"action" "consent_action" NOT NULL,
	"source" text,
	"raw_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"link_clicked" boolean DEFAULT false NOT NULL,
	"discount_code" text,
	"utm" jsonb,
	"attributed_revenue_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_attributed_conversation_id_conversations_id_fk" FOREIGN KEY ("attributed_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integrations_brand_kind_idx" ON "integrations" USING btree ("brand_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_brand_phone_uq" ON "customers" USING btree ("brand_id","phone_e164");--> statement-breakpoint
CREATE INDEX "product_variants_brand_idx" ON "product_variants" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "order_line_items_order_idx" ON "order_line_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_brand_customer_idx" ON "orders" USING btree ("brand_id","customer_id");--> statement-breakpoint
CREATE INDEX "orders_brand_fulfillment_idx" ON "orders" USING btree ("brand_id","fulfillment_status");--> statement-breakpoint
CREATE INDEX "conversations_brand_status_idx" ON "conversations" USING btree ("brand_id","status");--> statement-breakpoint
CREATE INDEX "conversations_brand_last_message_idx" ON "conversations" USING btree ("brand_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_customer_idx" ON "conversations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_actions_one_open_per_conversation" ON "pending_actions" USING btree ("conversation_id") WHERE "pending_actions"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "events_brand_unprocessed_idx" ON "events" USING btree ("brand_id","processed_at");--> statement-breakpoint
CREATE INDEX "playbooks_brand_key_idx" ON "playbooks" USING btree ("brand_id","key");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_hnsw" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "knowledge_chunks_brand_source_idx" ON "knowledge_chunks" USING btree ("brand_id","source_type");--> statement-breakpoint
CREATE INDEX "audit_log_brand_created_idx" ON "audit_log" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "consent_log_brand_customer_idx" ON "consent_log" USING btree ("brand_id","customer_id");--> statement-breakpoint
CREATE INDEX "attributions_brand_idx" ON "attributions" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "attributions_order_idx" ON "attributions" USING btree ("order_id");