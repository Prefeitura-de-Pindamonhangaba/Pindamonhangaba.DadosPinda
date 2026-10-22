import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/modules/auth/models/auth-schema";
import { createAuditRepository } from "@/modules/audit/models/audit-repository";
import { createUserRepository } from "@/modules/users/models/user-repository";
import { parseAuthEnvironment } from "@/shared/lib/env";

export function createAuthService(
  database: PostgresJsDatabase,
  env: ReturnType<typeof parseAuthEnvironment>,
) {
  const users = createUserRepository(database);
  const audit = createAuditRepository(database);
  return betterAuth({
    appName: "Pinda Dados",
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 8,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "viewer",
          input: false,
        },
        enabled: {
          type: "boolean",
          required: true,
          defaultValue: true,
          input: false,
        },
      },
    },
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (data) => {
            if (!(await users.isEnabled(data.userId)))
              throw new APIError("UNAUTHORIZED", {
                message: "Acesso não autorizado.",
              });
          },
          after: async (data) => {
            await audit.record(data.userId, "session.created");
          },
        },
        delete: {
          after: async (data) => {
            await audit.record(data.userId, "session.revoked");
          },
        },
      },
    },
    logger: {
      level: "error",
      // O SDK pode incluir consultas e tokens nos argumentos de diagnóstico.
      log: (level) => {
        console.error(JSON.stringify({ event: "auth.internal_error", level }));
      },
    },
  });
}
