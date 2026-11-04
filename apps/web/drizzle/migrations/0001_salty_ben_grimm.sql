CREATE TABLE "codebase_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codebase_id" uuid NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entries" jsonb NOT NULL,
	"skipped" jsonb NOT NULL,
	"errors" jsonb NOT NULL,
	"analysis" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codebases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"root_path" text NOT NULL,
	"file_count" integer NOT NULL,
	"total_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detected_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codebase_id" uuid NOT NULL,
	"name" text NOT NULL,
	"confidence" integer NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detected_technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codebase_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"confidence" integer NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codebase_scans" ADD CONSTRAINT "codebase_scans_codebase_id_codebases_id_fk" FOREIGN KEY ("codebase_id") REFERENCES "public"."codebases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codebases" ADD CONSTRAINT "codebases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_features" ADD CONSTRAINT "detected_features_codebase_id_codebases_id_fk" FOREIGN KEY ("codebase_id") REFERENCES "public"."codebases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_technologies" ADD CONSTRAINT "detected_technologies_codebase_id_codebases_id_fk" FOREIGN KEY ("codebase_id") REFERENCES "public"."codebases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "codebases_project_unique" ON "codebases" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "detected_features_codebase_name_unique" ON "detected_features" USING btree ("codebase_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "detected_technologies_codebase_name_unique" ON "detected_technologies" USING btree ("codebase_id","name");