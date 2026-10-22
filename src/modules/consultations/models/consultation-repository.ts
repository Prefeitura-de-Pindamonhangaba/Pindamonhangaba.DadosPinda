import { and, desc, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { consultationAudit, consultationCache } from "./consultation-schema";
import { ConsultationError } from "./consultation-types";

type Executor = Pick<
  PostgresJsDatabase,
  "select" | "insert" | "update" | "delete" | "execute"
>;

export function createConsultationRepository(database: Executor) {
  return {
    async ownsRecords(ids: string[], userId: string) {
      const [result] = await database
        .select({ count: sql<number>`count(*)::int` })
        .from(consultationAudit)
        .where(
          and(
            inArray(consultationAudit.id, [...new Set(ids)]),
            eq(consultationAudit.userId, userId),
          ),
        );
      return result.count === new Set(ids).size;
    },
    async purgeExpired() {
      await database
        .delete(consultationCache)
        .where(lt(consultationCache.expiresAt, new Date()));
    },
    async findCache(
      key: string,
    ): Promise<typeof consultationCache.$inferSelect | undefined> {
      const [row] = await database
        .select()
        .from(consultationCache)
        .where(
          and(
            eq(consultationCache.key, key),
            gt(consultationCache.expiresAt, new Date()),
          ),
        );
      return row;
    },
    async saveCache(value: typeof consultationCache.$inferInsert) {
      await database
        .insert(consultationCache)
        .values(value)
        .onConflictDoUpdate({ target: consultationCache.key, set: value });
    },
    async reserve(
      value: typeof consultationAudit.$inferInsert,
      perMinute: number,
      monthlyLimit?: number,
      kindMonthlyLimit?: number,
    ) {
      await database.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"infoconv:user:" + value.userId}))`,
      );
      const since = new Date(Date.now() - 60_000);
      const [userCount] = await database
        .select({ count: sql<number>`count(*)::int` })
        .from(consultationAudit)
        .where(
          and(
            eq(consultationAudit.userId, value.userId),
            gte(consultationAudit.createdAt, since),
          ),
        );
      if (userCount.count >= 120) throw new ConsultationError("rate_limit");
      if (value.origin === "serpro") {
        // Limite global compartilhado entre processos e instâncias.
        await database.execute(
          sql`select pg_advisory_xact_lock(hashtext('infoconv:quota'))`,
        );
        if (monthlyLimit || kindMonthlyLimit) {
          const month = new Date();
          month.setUTCDate(1);
          month.setUTCHours(0, 0, 0, 0);
          const [usage] = await database
            .select({
              total: sql<number>`count(*)::int`,
              kind: sql<number>`count(*) filter (where ${consultationAudit.kind} = ${value.kind})::int`,
            })
            .from(consultationAudit)
            .where(
              and(
                eq(consultationAudit.origin, "serpro"),
                gte(consultationAudit.createdAt, month),
              ),
            );
          if (
            (monthlyLimit && usage.total >= monthlyLimit) ||
            (kindMonthlyLimit && usage.kind >= kindMonthlyLimit)
          )
            throw new ConsultationError("monthly_limit");
        }
        const [count] = await database
          .select({ count: sql<number>`count(*)::int` })
          .from(consultationAudit)
          .where(
            and(
              eq(consultationAudit.origin, "serpro"),
              gte(consultationAudit.createdAt, since),
            ),
          );
        if (count.count >= perMinute) throw new ConsultationError("rate_limit");
        const [last] = await database
          .select({ createdAt: consultationAudit.createdAt })
          .from(consultationAudit)
          .where(eq(consultationAudit.origin, "serpro"))
          .orderBy(desc(consultationAudit.createdAt))
          .limit(1);
        if (last) {
          const remaining = 1000 - (Date.now() - last.createdAt.getTime());
          if (remaining > 0)
            await new Promise((resolve) => setTimeout(resolve, remaining));
        }
      }
      const [row] = await database
        .insert(consultationAudit)
        .values({ ...value, createdAt: new Date() })
        .returning({ id: consultationAudit.id });
      return row.id;
    },
    async complete(id: string, status: string) {
      await database
        .update(consultationAudit)
        .set({ status })
        .where(eq(consultationAudit.id, id));
    },
    async listAudit(userId?: string) {
      return database
        .select()
        .from(consultationAudit)
        .where(userId ? eq(consultationAudit.userId, userId) : undefined)
        .orderBy(desc(consultationAudit.createdAt))
        .limit(250);
    },
    async usage() {
      const month = new Date();
      month.setUTCDate(1);
      month.setUTCHours(0, 0, 0, 0);
      return database
        .select({
          kind: consultationAudit.kind,
          origin: consultationAudit.origin,
          count: sql<number>`count(*)::int`,
        })
        .from(consultationAudit)
        .where(gte(consultationAudit.createdAt, month))
        .groupBy(consultationAudit.kind, consultationAudit.origin);
    },
  };
}
export type ConsultationRepository = ReturnType<
  typeof createConsultationRepository
>;

export function withDocumentLock<T>(
  database: PostgresJsDatabase,
  key: string,
  work: (repository: ConsultationRepository) => Promise<T>,
) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    return work(createConsultationRepository(tx));
  });
}
