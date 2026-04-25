import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const embedCalls = pgTable("embedCalls", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicKey: text("publicKey").notNull(),
  agentId: uuid("agentId").notNull(),
  room: text("room").notNull(),
  startedAt: timestamp("startedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  endedAt: timestamp("endedAt", { withTimezone: true }),
});

export type EmbedCallRow = typeof embedCalls.$inferSelect;
export type NewEmbedCall = typeof embedCalls.$inferInsert;
