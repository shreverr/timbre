CREATE TABLE "callLogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"agentId" uuid NOT NULL,
	"mode" text NOT NULL,
	"room" text NOT NULL,
	"callerIdentity" text,
	"startedAt" timestamp with time zone NOT NULL,
	"endedAt" timestamp with time zone NOT NULL,
	"durationSeconds" integer NOT NULL,
	"transcript" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
