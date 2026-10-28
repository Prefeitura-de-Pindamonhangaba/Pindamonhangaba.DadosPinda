import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { account, session, user } from "@/modules/auth/models/auth-schema";
import { auditEvent } from "@/modules/audit/models/audit-schema";

export function createKeycloakBindingRepository(database: PostgresJsDatabase) {
  return {
    async apply(input: {
      actorId: string;
      userId: string;
      action: "link" | "unlink";
      accountId?: string;
    }) {
      return database.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(190023, 2)`);
        const [actor] = await tx
          .select({ role: user.role, enabled: user.enabled })
          .from(user)
          .where(eq(user.id, input.actorId));
        if (!actor?.enabled || actor.role !== "admin")
          throw new Error("Administrador ativo obrigatório.");
        const [target] = await tx
          .select({ enabled: user.enabled })
          .from(user)
          .where(eq(user.id, input.userId));
        if (!target || (input.action === "link" && !target.enabled))
          throw new Error("Usuário ativo não encontrado.");
        if (input.action === "link") {
          if (!input.accountId) throw new Error("Identidade inválida.");
          const existing = await tx
            .select({ id: account.id })
            .from(account)
            .where(
              and(
                eq(account.userId, input.userId),
                eq(account.providerId, "keycloak"),
              ),
            );
          if (existing.length)
            throw new Error(
              "Remova o vínculo anterior antes de vincular outra identidade.",
            );
          await tx.insert(account).values({
            providerId: "keycloak",
            accountId: input.accountId,
            userId: input.userId,
          });
        } else {
          await tx
            .delete(account)
            .where(
              and(
                eq(account.userId, input.userId),
                eq(account.providerId, "keycloak"),
              ),
            );
        }
        await tx.delete(session).where(eq(session.userId, input.userId));
        await tx.insert(auditEvent).values({
          userId: input.userId,
          actorId: input.actorId,
          action:
            input.action === "link"
              ? "user.keycloak_linked"
              : "user.keycloak_unlinked",
        });
      });
    },
  };
}
