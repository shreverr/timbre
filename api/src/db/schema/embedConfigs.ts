import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const embedConfigs = pgTable("embedConfigs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  agentId: uuid("agentId").notNull().unique(),
  publicKey: text("publicKey").notNull().unique(),
  allowedOrigins: text("allowedOrigins").notNull(),
  enabled: boolean("enabled").notNull().default(true),

  buttonLabel: text("buttonLabel"),
  buttonShape: text("buttonShape").notNull().default("circle"),
  buttonIconSvg: text("buttonIconSvg"),
  accentColor: text("accentColor").notNull().default("#f59e0b"),
  position: text("position").notNull().default("bottom-right"),
  greetingText: text("greetingText"),

  maxConcurrent: integer("maxConcurrent").notNull().default(5),
  dailyCallQuota: integer("dailyCallQuota").notNull().default(200),

  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type EmbedConfigRow = typeof embedConfigs.$inferSelect;
export type NewEmbedConfig = typeof embedConfigs.$inferInsert;
