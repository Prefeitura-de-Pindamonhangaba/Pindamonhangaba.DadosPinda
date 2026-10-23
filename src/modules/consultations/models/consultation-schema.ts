import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "@/modules/auth/models/auth-schema";

export const consultationAudit = pgTable(
  "consultation_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    batchId: uuid("batch_id").notNull(),
    kind: text("kind").notNull(),
    source: text("source").notNull().default("infoconv"),
    documentDigest: text("document_digest").notNull(),
    documentMasked: text("document_masked").notNull(),
    purpose: text("purpose").notNull(),
    status: text("status").notNull().default("pending"),
    origin: text("origin").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("consultation_audit_user_date_idx").on(table.userId, table.createdAt),
    index("consultation_audit_batch_idx").on(table.batchId),
  ],
);

export const consultationCache = pgTable(
  "consultation_cache",
  {
    key: text("key").primaryKey(),
    kind: text("kind").notNull(),
    ciphertext: text("ciphertext").notNull(),
    obtainedAt: timestamp("obtained_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("consultation_cache_expires_idx").on(table.expiresAt),
    check(
      "consultation_cache_retention_check",
      sql`${table.expiresAt} > ${table.obtainedAt} and ${table.expiresAt} <= ${table.obtainedAt} + interval '7 days'`,
    ),
  ],
);
