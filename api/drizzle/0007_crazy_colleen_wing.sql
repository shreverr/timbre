CREATE TABLE "embedCalls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publicKey" text NOT NULL,
	"agentId" uuid NOT NULL,
	"room" text NOT NULL,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"endedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "embedConfigs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"agentId" uuid NOT NULL,
	"publicKey" text NOT NULL,
	"allowedOrigins" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"buttonLabel" text,
	"buttonShape" text DEFAULT 'circle' NOT NULL,
	"buttonIconSvg" text,
	"accentColor" text DEFAULT '#f59e0b' NOT NULL,
	"position" text DEFAULT 'bottom-right' NOT NULL,
	"greetingText" text,
	"maxConcurrent" integer DEFAULT 5 NOT NULL,
	"dailyCallQuota" integer DEFAULT 200 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embedConfigs_agentId_unique" UNIQUE("agentId"),
	CONSTRAINT "embedConfigs_publicKey_unique" UNIQUE("publicKey")
);
