import { and, desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { user, session, account } from "@/modules/auth/models/auth-schema";
import { auditEvent } from "@/modules/audit/models/audit-schema";
import type { Role } from "@/modules/auth/permissions";

export class UserManagementError extends Error {
  constructor(public readonly code: "not_found" | "last_admin") {
    super(code);
  }
}

export function createAdminUserRepository(database: PostgresJsDatabase) {
  return {
    async importProfiles(
      items: {
        name: string;
        email: string;
        role: Role;
        passwordHash: string;
      }[],
      actorId: string,
    ) {
      return database.transaction(async (tx) => {
        let created = 0;
        for (const item of items) {
          const [profile] = await tx
            .insert(user)
            .values({
              name: item.name,
              email: item.email,
              role: item.role,
              enabled: false,
            })
            .onConflictDoNothing({ target: user.email })
            .returning({ id: user.id });
          if (!profile) continue;
          await tx.insert(account).values({
            userId: profile.id,
            accountId: profile.id,
            providerId: "credential",
            password: item.passwordHash,
          });
          await tx.insert(auditEvent).values({
            userId: profile.id,
            actorId,
            action: "user.imported_disabled",
          });
          created++;
        }
        return { created, skipped: items.length - created };
      });
    },
    async recordExport(actorId: string) {
      await database
        .insert(auditEvent)
        .values({ userId: actorId, actorId, action: "users.exported" });
    },
    async list() {
      return database
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          enabled: user.enabled,
          createdAt: user.createdAt,
        })
        .from(user)
        .orderBy(desc(user.createdAt))
        .limit(500);
    },
    async create(
      input: { name: string; email: string; role: Role; passwordHash: string },
      actorId: string,
    ) {
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
          .values({ userId: created.id, actorId, action: "user.provisioned" });
        return created;
      });
    },
    async update(
      input: {
        id: string;
        name: string;
        email: string;
        role: Role;
        enabled: boolean;
        passwordHash?: string;
      },
      actorId: string,
    ) {
      await database.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('admin:users'))`,
        );
        const [target] = await tx
          .select()
          .from(user)
          .where(eq(user.id, input.id));
        if (!target) throw new UserManagementError("not_found");
        if (
          target.role === "admin" &&
          target.enabled &&
          (!input.enabled || input.role !== "admin")
        ) {
          const [count] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(user)
            .where(and(eq(user.role, "admin"), eq(user.enabled, true)));
          if (count.count <= 1) throw new UserManagementError("last_admin");
        }
        await tx
          .update(user)
          .set({
            name: input.name,
            email: input.email,
            role: input.role,
            enabled: input.enabled,
            updatedAt: new Date(),
          })
          .where(eq(user.id, input.id));
        if (input.passwordHash)
          await tx
            .update(account)
            .set({ password: input.passwordHash, updatedAt: new Date() })
            .where(
              and(
                eq(account.userId, input.id),
                eq(account.providerId, "credential"),
              ),
            );
        if (!input.enabled || input.role !== target.role || input.passwordHash)
          await tx.delete(session).where(eq(session.userId, input.id));
        await tx.insert(auditEvent).values({
          userId: input.id,
          actorId,
          action: input.passwordHash
            ? "user.password_reset"
            : "user.access_updated",
        });
      });
    },
  };
}
