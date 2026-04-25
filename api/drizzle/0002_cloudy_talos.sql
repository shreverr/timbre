CREATE TYPE "public"."agentType" AS ENUM('SINGLE', 'MULTI');--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "type" "agentType" DEFAULT 'SINGLE' NOT NULL;