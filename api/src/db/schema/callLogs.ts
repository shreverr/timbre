import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const callLogs = pgTable("callLogs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  agentId: uuid("agentId").notNull(),
  mode: text("mode").notNull(),
  room: text("room").notNull(),
  callerIdentity: text("callerIdentity"),
  startedAt: timestamp("startedAt", { withTimezone: true }).notNull(),
  endedAt: timestamp("endedAt", { withTimezone: true }).notNull(),
  durationSeconds: integer("durationSeconds").notNull(),
  transcript: text("transcript").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type CallLogRow = typeof callLogs.$inferSelect;
export type NewCallLog = typeof callLogs.$inferInsert;
