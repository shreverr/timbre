import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const mcpServers = pgTable("mcpServers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  agentId: uuid("agentId").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  transport: text("transport").notNull().default("auto"),
  headers: text("headers"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type McpServerRow = typeof mcpServers.$inferSelect;
export type NewMcpServer = typeof mcpServers.$inferInsert;
