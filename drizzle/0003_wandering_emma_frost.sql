CREATE TABLE "infoconv_quota_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"additional" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "infoconv_quota_additional_check" CHECK ("infoconv_quota_approvals"."additional" between 0 and 1000000),
	CONSTRAINT "infoconv_quota_month_check" CHECK ("infoconv_quota_approvals"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
ALTER TABLE "infoconv_quota_approvals" ADD CONSTRAINT "infoconv_quota_approvals_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "infoconv_quota_month_date_idx" ON "infoconv_quota_approvals" USING btree ("month","created_at");