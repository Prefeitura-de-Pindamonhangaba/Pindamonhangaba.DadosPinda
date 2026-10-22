import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "@/modules/auth/models/auth-schema";

export const auditEvent = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    correlationId: uuid("correlation_id").notNull().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_user_created_idx").on(table.userId, table.createdAt),
  ],
);
