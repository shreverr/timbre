import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const knowledgeBases = pgTable("knowledgeBases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  name: text("name").notNull(),
  toolDescription: text("toolDescription"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type KnowledgeBaseRow = typeof knowledgeBases.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;
