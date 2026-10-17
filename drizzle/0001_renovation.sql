CREATE TYPE "public"."certification" AS ENUM('waterproofing', 'electrical', 'plumbing', 'asbestos');--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('kitchen', 'bathroom', 'flooring', 'walls_paint', 'doors', 'electrical', 'sauna', 'balcony', 'general');--> statement-breakpoint
CREATE TYPE "public"."cost_unit" AS ENUM('m2', 'lm', 'pcs', 'set', 'room');--> statement-breakpoint
CREATE TYPE "public"."quality_tier" AS ENUM('budget', 'mid', 'premium');--> statement-breakpoint
CREATE TYPE "public"."room_type" AS ENUM('kitchen', 'bathroom', 'toilet', 'sauna', 'living_room', 'bedroom', 'hallway', 'balcony', 'whole_apartment');--> statement-breakpoint
CREATE TABLE "cost_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"base_item_id" uuid,
	"code" text NOT NULL,
	"category" "cost_category" NOT NULL,
	"name_en" text NOT NULL,
	"name_fi" text,
	"unit" "cost_unit" NOT NULL,
	"budget_low" bigint NOT NULL,
	"budget_high" bigint NOT NULL,
	"mid_low" bigint NOT NULL,
	"mid_high" bigint NOT NULL,
	"premium_low" bigint NOT NULL,
	"premium_high" bigint NOT NULL,
	"labor_bps" integer NOT NULL,
	"certification" "certification",
	"needs_renovation_notice" boolean DEFAULT false NOT NULL,
	"price_date" date NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"cost_item_id" uuid,
	"code" text,
	"name" text NOT NULL,
	"unit" "cost_unit" NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"tier" "quality_tier" NOT NULL,
	"unit_price" bigint NOT NULL,
	"unit_price_low" bigint NOT NULL,
	"unit_price_high" bigint NOT NULL,
	"price_overridden" boolean DEFAULT false NOT NULL,
	"labor_bps" integer NOT NULL,
	"certification" "certification",
	"needs_renovation_notice" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"price_date" date,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"room_type" "room_type" NOT NULL,
	"name" text NOT NULL,
	"area_m2" numeric(7, 1),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renovation_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"default_tier" "quality_tier" DEFAULT 'mid' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renovation_plan_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
ALTER TABLE "cost_item" ADD CONSTRAINT "cost_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_item" ADD CONSTRAINT "cost_item_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_line" ADD CONSTRAINT "plan_line_room_id_plan_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."plan_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_line" ADD CONSTRAINT "plan_line_plan_id_renovation_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."renovation_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_line" ADD CONSTRAINT "plan_line_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_line" ADD CONSTRAINT "plan_line_cost_item_id_cost_item_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_room" ADD CONSTRAINT "plan_room_plan_id_renovation_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."renovation_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_room" ADD CONSTRAINT "plan_room_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renovation_plan" ADD CONSTRAINT "renovation_plan_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renovation_plan" ADD CONSTRAINT "renovation_plan_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_item_platform_code_uq" ON "cost_item" USING btree ("code") WHERE "cost_item"."organization_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_item_org_code_uq" ON "cost_item" USING btree ("organization_id","code") WHERE "cost_item"."organization_id" is not null;--> statement-breakpoint
CREATE INDEX "cost_item_org_idx" ON "cost_item" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "plan_line_room_idx" ON "plan_line" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "plan_line_plan_idx" ON "plan_line" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_room_plan_idx" ON "plan_room" USING btree ("plan_id");