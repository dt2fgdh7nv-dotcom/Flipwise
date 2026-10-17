CREATE TYPE "public"."building_type" AS ENUM('apartment', 'rowhouse', 'semi_detached');--> statement-breakpoint
CREATE TYPE "public"."condition_rating" AS ENUM('good', 'satisfactory', 'fair', 'poor');--> statement-breakpoint
CREATE TYPE "public"."maintenance_kind" AS ENUM('pipe_renovation', 'facade', 'roof', 'windows', 'balconies', 'elevator', 'electrical', 'drainage', 'yard', 'other');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('planned', 'decided', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."ownership_form" AS ENUM('housing_company_share', 'real_estate');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('free', 'pro', 'team');--> statement-breakpoint
CREATE TYPE "public"."plot_type" AS ENUM('owned', 'leased', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('lead', 'analyzing', 'offer_made', 'purchased', 'renovating', 'listed', 'sold');--> statement-breakpoint
CREATE TYPE "public"."risk_severity" AS ENUM('info', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."scenario_kind" AS ENUM('best', 'expected', 'worst');--> statement-breakpoint
CREATE TYPE "public"."share_role" AS ENUM('viewer', 'commenter');--> statement-breakpoint
CREATE TYPE "public"."share_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."tax_profile" AS ENUM('company', 'individual');--> statement-breakpoint
CREATE TYPE "public"."vat_display" AS ENUM('excl', 'incl');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"author_id" text,
	"target" text DEFAULT 'project' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comparable_sale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" uuid,
	"street_address" text,
	"postal_code" text NOT NULL,
	"municipality" text,
	"building_type" "building_type" NOT NULL,
	"living_area_m2" numeric(7, 1) NOT NULL,
	"rooms" integer,
	"build_year" integer,
	"floor" integer,
	"condition" "condition_rating",
	"price_debt_free" bigint NOT NULL,
	"sale_date" date NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"entered_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"key" text NOT NULL,
	"value" numeric NOT NULL,
	"unit" text NOT NULL,
	"valid_from" date NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"notes" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"asking_price" bigint NOT NULL,
	"offer_price" bigint,
	"debt_share" bigint DEFAULT 0 NOT NULL,
	"maintenance_fee_monthly" bigint DEFAULT 0 NOT NULL,
	"financing_fee_monthly" bigint DEFAULT 0 NOT NULL,
	"utilities_monthly" bigint DEFAULT 0 NOT NULL,
	"other_acquisition_costs" bigint DEFAULT 0 NOT NULL,
	"other_selling_costs" bigint DEFAULT 0 NOT NULL,
	"agent_fee_bps" integer NOT NULL,
	"loan_to_value_bps" integer DEFAULT 0 NOT NULL,
	"loan_arrangement_fee" bigint DEFAULT 0 NOT NULL,
	"tax_profile" "tax_profile" DEFAULT 'company' NOT NULL,
	"actual_purchase_price" bigint,
	"actual_renovation_cost" bigint,
	"actual_holding_months" numeric,
	"actual_sale_price" bigint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_analysis_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "deal_scenario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_analysis_id" uuid NOT NULL,
	"kind" "scenario_kind" NOT NULL,
	"sale_price_debt_free" bigint NOT NULL,
	"renovation_budget" bigint NOT NULL,
	"contingency_bps" integer DEFAULT 1000 NOT NULL,
	"holding_months" numeric NOT NULL,
	"interest_rate_bps" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dev_mail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "housing_company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"name" text,
	"business_id" text,
	"manager_name" text,
	"manager_email" text,
	"manager_phone" text,
	"units_total" integer,
	"last_pipe_renovation_year" integer,
	"last_facade_renovation_year" integer,
	"last_roof_renovation_year" integer,
	"manager_certificate_date" date,
	"maintenance_plan_date" date,
	"renovation_notice_notes" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "housing_company_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_risk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"severity" "risk_severity" DEFAULT 'medium' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_series_point" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_table" text NOT NULL,
	"area_code" text NOT NULL,
	"area_name" text,
	"building_segment" text NOT NULL,
	"period" text NOT NULL,
	"price_per_m2" bigint,
	"transactions" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"plan_tier" "plan_tier" DEFAULT 'free' NOT NULL,
	"billing_customer_id" text,
	"default_tax_profile" "tax_profile" DEFAULT 'company' NOT NULL,
	"vat_display" "vat_display" DEFAULT 'excl' NOT NULL,
	"vat_deductible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "planned_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"housing_company_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"kind" "maintenance_kind" NOT NULL,
	"planned_year" integer NOT NULL,
	"status" "maintenance_status" DEFAULT 'planned' NOT NULL,
	"est_cost_per_m2" bigint,
	"source" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "project_status" DEFAULT 'lead' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purchased_at" date,
	"listed_at" date,
	"sold_at" date,
	"notes" text,
	"created_by" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"role" "share_role" DEFAULT 'viewer' NOT NULL,
	"status" "share_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_share_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "project_status_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"from_status" "project_status",
	"to_status" "project_status" NOT NULL,
	"changed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"street_address" text NOT NULL,
	"unit" text,
	"postal_code" text NOT NULL,
	"municipality" text NOT NULL,
	"district" text,
	"latitude" numeric,
	"longitude" numeric,
	"building_type" "building_type" NOT NULL,
	"ownership_form" "ownership_form" DEFAULT 'housing_company_share' NOT NULL,
	"living_area_m2" numeric(7, 1) NOT NULL,
	"rooms" integer NOT NULL,
	"layout" text,
	"build_year" integer NOT NULL,
	"floor" integer,
	"floors_total" integer,
	"has_elevator" boolean,
	"has_sauna" boolean DEFAULT false NOT NULL,
	"has_balcony" boolean DEFAULT false NOT NULL,
	"plot_type" "plot_type" DEFAULT 'unknown' NOT NULL,
	"condition" "condition_rating" DEFAULT 'satisfactory' NOT NULL,
	"energy_class" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparable_sale" ADD CONSTRAINT "comparable_sale_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparable_sale" ADD CONSTRAINT "comparable_sale_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparable_sale" ADD CONSTRAINT "comparable_sale_entered_by_user_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_value" ADD CONSTRAINT "config_value_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_value" ADD CONSTRAINT "config_value_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_analysis" ADD CONSTRAINT "deal_analysis_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_analysis" ADD CONSTRAINT "deal_analysis_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_scenario" ADD CONSTRAINT "deal_scenario_deal_analysis_id_deal_analysis_id_fk" FOREIGN KEY ("deal_analysis_id") REFERENCES "public"."deal_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housing_company" ADD CONSTRAINT "housing_company_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housing_company" ADD CONSTRAINT "housing_company_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_risk" ADD CONSTRAINT "manual_risk_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_risk" ADD CONSTRAINT "manual_risk_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_risk" ADD CONSTRAINT "manual_risk_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_maintenance" ADD CONSTRAINT "planned_maintenance_housing_company_id_housing_company_id_fk" FOREIGN KEY ("housing_company_id") REFERENCES "public"."housing_company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_maintenance" ADD CONSTRAINT "planned_maintenance_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share" ADD CONSTRAINT "project_share_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share" ADD CONSTRAINT "project_share_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share" ADD CONSTRAINT "project_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share" ADD CONSTRAINT "project_share_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_event" ADD CONSTRAINT "project_status_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_event" ADD CONSTRAINT "project_status_event_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_project_idx" ON "comment" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "comparable_org_postal_idx" ON "comparable_sale" USING btree ("organization_id","postal_code");--> statement-breakpoint
CREATE INDEX "comparable_project_idx" ON "comparable_sale" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "config_key_idx" ON "config_value" USING btree ("key","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_deal_kind_uq" ON "deal_scenario" USING btree ("deal_analysis_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "market_point_uq" ON "market_series_point" USING btree ("source","source_table","area_code","building_segment","period");--> statement-breakpoint
CREATE INDEX "member_org_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_uq" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "project_org_idx" ON "project" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "share_user_idx" ON "project_share" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "share_project_email_uq" ON "project_share" USING btree ("project_id","email");--> statement-breakpoint
CREATE INDEX "property_org_idx" ON "property" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "property_postal_idx" ON "property" USING btree ("postal_code");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");