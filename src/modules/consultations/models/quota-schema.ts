import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "@/modules/auth/models/auth-schema";

export const quotaApproval = pgTable(
  "infoconv_quota_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    month: text("month").notNull(),
    additional: integer("additional").notNull(),
    reason: text("reason").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("infoconv_quota_month_date_idx").on(table.month, table.createdAt),
    check(
      "infoconv_quota_additional_check",
      sql`${table.additional} between 0 and 1000000`,
    ),
    check(
      "infoconv_quota_month_check",
      sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
  ],
);
