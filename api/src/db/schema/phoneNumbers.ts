import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const phoneNumbers = pgTable("phoneNumbers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  providerId: uuid("providerId").notNull(),
  agentId: uuid("agentId"),
  e164: text("e164").notNull(),
  livekitInboundTrunkId: text("livekitInboundTrunkId"),
  dispatchRuleId: text("dispatchRuleId"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type PhoneNumberRow = typeof phoneNumbers.$inferSelect;
export type NewPhoneNumber = typeof phoneNumbers.$inferInsert;
