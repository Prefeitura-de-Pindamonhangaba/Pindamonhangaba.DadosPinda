import { desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { quotaApproval } from "./quota-schema";
import { auditEvent } from "@/modules/audit/models/audit-schema";
import { currentQuotaMonth } from "../services/quota-policy";

export async function readAdditionalAllowance(
  database: Pick<PostgresJsDatabase, "select">,
  month: string,
) {
  const [last] = await database
    .select()
    .from(quotaApproval)
    .where(eq(quotaApproval.month, month))
    .orderBy(desc(quotaApproval.createdAt))
    .limit(1);
  return last?.additional ?? 0;
}
export function createQuotaRepository(database: PostgresJsDatabase) {
  return {
    async read(month: string) {
      const history = await database
        .select()
        .from(quotaApproval)
        .where(eq(quotaApproval.month, month))
        .orderBy(desc(quotaApproval.createdAt))
        .limit(50);
      return { additional: history[0]?.additional ?? 0, history };
    },
    async approve(value: typeof quotaApproval.$inferInsert) {
      await database.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('infoconv:quota'))`,
        );
        if (value.month !== currentQuotaMonth())
          throw new Error("quota_month_changed");
        await tx
          .insert(quotaApproval)
          .values({ ...value, createdAt: sql`clock_timestamp()` });
        await tx.insert(auditEvent).values({
          userId: value.actorId,
          actorId: value.actorId,
          action:
            value.additional === 0
              ? "infoconv.quota_revoked"
              : "infoconv.quota_approved",
        });
      });
    },
  };
}
