import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import { account, session, user } from "@/modules/auth/models/auth-schema";
import { auditEvent } from "@/modules/audit/models/audit-schema";
import type { Role } from "@/modules/auth/permissions";

export function createUserRepository(database: PostgresJsDatabase) {
  return {
    async changeAccess(input: {
      email: string;
      action: "disable" | "reset-password";
      passwordHash?: string;
    }) {
      return database.transaction(async (tx) => {
        const [target] = await tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, input.email));
        if (!target) throw new Error("Usuário não encontrado.");
        if (input.action === "disable")
          await tx
            .update(user)
            .set({ enabled: false, updatedAt: new Date() })
            .where(eq(user.id, target.id));
        else
          await tx
            .update(account)
            .set({ password: input.passwordHash, updatedAt: new Date() })
            .where(
              and(
                eq(account.userId, target.id),
                eq(account.providerId, "credential"),
              ),
            );
        await tx.delete(session).where(eq(session.userId, target.id));
        await tx.insert(auditEvent).values({
          userId: target.id,
          action:
            input.action === "disable"
              ? "user.disabled"
              : "user.password_reset",
        });
      });
    },
    async isEnabled(id: string) {
      const [result] = await database
        .select({ enabled: user.enabled })
        .from(user)
        .where(eq(user.id, id));
      return result?.enabled === true;
    },
    async create(input: {
      name: string;
      email: string;
      passwordHash: string;
      role: Role;
    }) {
      return database.transaction(async (tx) => {
        const [created] = await tx
          .insert(user)
          .values({ name: input.name, email: input.email, role: input.role })
          .returning({ id: user.id });
        await tx.insert(account).values({
          userId: created.id,
          accountId: created.id,
          providerId: "credential",
          password: input.passwordHash,
        });
        await tx
          .insert(auditEvent)
          .values({ userId: created.id, action: "user.provisioned" });
        return created;
      });
    },
  };
}
