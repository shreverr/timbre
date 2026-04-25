CREATE TYPE "public"."providerType" AS ENUM('twilio');--> statement-breakpoint
CREATE TABLE "phoneNumbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"providerId" uuid NOT NULL,
	"agentId" uuid,
	"e164" text NOT NULL,
	"livekitInboundTrunkId" text,
	"dispatchRuleId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telephonyProviders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" "providerType" NOT NULL,
	"label" text NOT NULL,
	"credentials" text NOT NULL,
	"livekitOutboundTrunkId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
