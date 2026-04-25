import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const agentTypeEnum = pgEnum("agentType", ["SINGLE", "MULTI"]);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  name: text("name").notNull(),
  type: agentTypeEnum("type").default("SINGLE").notNull(),
  voiceId: text("voiceId"),
  language: text("language").default("multi").notNull(),
  firstMessage: text("firstMessage"),
  objective: text("objective"),
  responseGuidelines: text("responseGuidelines"),
  conversationScript: text("conversationScript"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentType = (typeof agentTypeEnum.enumValues)[number];
