import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const kbDocuments = pgTable("kbDocuments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  knowledgeBaseId: uuid("knowledgeBaseId").notNull(),
  name: text("name").notNull(),
  mimeType: text("mimeType").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  status: text("status").notNull().default("processing"),
  errorMessage: text("errorMessage"),
  chunkCount: integer("chunkCount").notNull().default(0),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type KbDocumentRow = typeof kbDocuments.$inferSelect;
export type NewKbDocument = typeof kbDocuments.$inferInsert;
