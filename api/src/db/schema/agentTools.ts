import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const toolPhaseEnum = pgEnum("toolPhase", ["PRE", "ON", "POST"]);
export const httpMethodEnum = pgEnum("httpMethod", [
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
]);

export const agentTools = pgTable("agentTools", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  agentId: uuid("agentId").notNull(),
  phase: toolPhaseEnum("phase").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  method: httpMethodEnum("method").notNull(),
  url: text("url").notNull(),
  headers: text("headers"),
  bodyTemplate: text("bodyTemplate"),
  parameters: text("parameters"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type AgentToolRow = typeof agentTools.$inferSelect;
export type NewAgentTool = typeof agentTools.$inferInsert;
export type ToolPhase = (typeof toolPhaseEnum.enumValues)[number];
export type HttpMethod = (typeof httpMethodEnum.enumValues)[number];
