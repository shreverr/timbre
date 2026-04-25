import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

export const agentKnowledgeBases = pgTable(
  "agentKnowledgeBases",
  {
    agentId: uuid("agentId").notNull(),
    knowledgeBaseId: uuid("knowledgeBaseId").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.agentId, t.knowledgeBaseId] }),
  }),
);

export type AgentKnowledgeBaseRow = typeof agentKnowledgeBases.$inferSelect;
export type NewAgentKnowledgeBase = typeof agentKnowledgeBases.$inferInsert;
