import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const providerTypeEnum = pgEnum("providerType", ["twilio"]);

export const telephonyProviders = pgTable("telephonyProviders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  type: providerTypeEnum("type").notNull(),
  label: text("label").notNull(),
  credentials: text("credentials").notNull(),
  livekitOutboundTrunkId: text("livekitOutboundTrunkId"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TelephonyProviderRow = typeof telephonyProviders.$inferSelect;
export type NewTelephonyProvider = typeof telephonyProviders.$inferInsert;
