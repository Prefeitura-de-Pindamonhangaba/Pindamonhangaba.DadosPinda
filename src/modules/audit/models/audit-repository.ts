import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { auditEvent } from "./audit-schema";

export function createAuditRepository(database: PostgresJsDatabase) {
  return {
    async record(
      userId: string,
      action:
        | "session.created"
        | "session.revoked"
        | "user.credentials_updated"
        | "consultations.exported"
        | "consultations.printed",
    ) {
      await database
        .insert(auditEvent)
        .values({ userId, actorId: userId, action });
    },
  };
}
