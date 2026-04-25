CREATE TYPE "public"."httpMethod" AS ENUM('GET', 'POST', 'PATCH', 'PUT', 'DELETE');--> statement-breakpoint
CREATE TYPE "public"."toolPhase" AS ENUM('PRE', 'ON', 'POST');--> statement-breakpoint
CREATE TABLE "agentTools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"agentId" uuid NOT NULL,
	"phase" "toolPhase" NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"method" "httpMethod" NOT NULL,
	"url" text NOT NULL,
	"headers" text,
	"bodyTemplate" text,
	"parameters" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcpServers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"agentId" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"transport" text DEFAULT 'auto' NOT NULL,
	"headers" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
