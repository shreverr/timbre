import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const kbChunks = pgTable("kbChunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("documentId").notNull(),
  knowledgeBaseId: uuid("knowledgeBaseId").notNull(),
  text: text("text").notNull(),
  position: integer("position").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type KbChunkRow = typeof kbChunks.$inferSelect;
export type NewKbChunk = typeof kbChunks.$inferInsert;
