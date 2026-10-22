ALTER TYPE "public"."user_role" ADD VALUE 'operator' BEFORE 'admin';--> statement-breakpoint
CREATE TABLE "consultation_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text DEFAULT 'infoconv' NOT NULL,
	"document_digest" text NOT NULL,
	"document_masked" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"origin" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ciphertext" text NOT NULL,
	"obtained_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_types" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "consultation_audit" ADD CONSTRAINT "consultation_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_values" ADD CONSTRAINT "reference_values_type_reference_types_code_fk" FOREIGN KEY ("type") REFERENCES "public"."reference_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consultation_audit_user_date_idx" ON "consultation_audit" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "consultation_audit_batch_idx" ON "consultation_audit" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "consultation_cache_expires_idx" ON "consultation_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_values_type_code_idx" ON "reference_values" USING btree ("type","code");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;