CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "agentKnowledgeBases" (
	"agentId" uuid NOT NULL,
	"knowledgeBaseId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agentKnowledgeBases_agentId_knowledgeBaseId_pk" PRIMARY KEY("agentId","knowledgeBaseId")
);
--> statement-breakpoint
CREATE TABLE "kbChunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"knowledgeBaseId" uuid NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kbDocuments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"knowledgeBaseId" uuid NOT NULL,
	"name" text NOT NULL,
	"mimeType" text NOT NULL,
	"sizeBytes" integer NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"errorMessage" text,
	"chunkCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledgeBases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" text NOT NULL,
	"toolDescription" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kb_chunks_kb_id" ON "kbChunks" ("knowledgeBaseId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kb_documents_kb_id" ON "kbDocuments" ("knowledgeBaseId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kb_chunks_embedding_hnsw" ON "kbChunks" USING hnsw ("embedding" vector_cosine_ops);
