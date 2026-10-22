import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { auditEvent } from "./audit-schema";

export function createAuditRepository(database: PostgresJsDatabase) {
  return {
    async record(
      userId: string,
      action: "session.created" | "session.revoked",
    ) {
      await database.insert(auditEvent).values({ userId, action });
    },
  };
}
