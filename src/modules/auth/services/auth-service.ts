import { parseKeycloakIdentity } from "./keycloak-identity";
import { createKeycloakIdentityRepository } from "../models/keycloak-identity-repository";
import { genericOAuth, keycloak } from "better-auth/plugins/generic-oauth";
import { keycloakAccountId } from "./keycloak-config";
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
  const identities = createKeycloakIdentityRepository(database);
  return betterAuth({
    appName: "Pinda Dados",
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    onAPIError: { errorURL: `${env.APP_URL}/login` },
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      transaction: true,
    }),
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: false, disableImplicitLinking: true },
    },
    plugins: env.keycloak.enabled
      ? [
          genericOAuth({
            config: [
              {
                ...keycloak({
                  issuer: env.keycloak.issuer,
                  clientId: env.keycloak.clientId,
                  clientSecret: env.keycloak.clientSecret,
                  pkce: true,
                  scopes: ["openid", "profile"],
                  disableSignUp: true,
                  disableImplicitSignUp: true,
                  overrideUserInfo: false,
                  disableProviderLogout: true,
                }),
                requireIdTokenVerification: true,
                requireEmailVerification: false,
                getUserInfo: async (tokens) => {
                  if (!tokens.idToken || !env.keycloak.enabled) return null;
                  // O SDK valida assinatura, issuer, audience e nonce antes desta callback.
                  const raw: unknown = JSON.parse(
                    Buffer.from(
                      tokens.idToken.split(".")[1],
                      "base64url",
                    ).toString("utf8"),
                  );
                  const identity = parseKeycloakIdentity(
                    raw,
                    env.keycloak.issuer,
                    env.keycloak.clientId,
                  );
                  if (!identity) {
                    console.error(
                      JSON.stringify({
                        event: "auth.keycloak_access_denied",
                        reason: "invalid_identity_or_client_roles",
                      }),
                    );
                    return null;
                  }
                  const local = await identities.synchronize(identity);
                  return {
                    iss: env.keycloak.issuer,
                    sub: identity.subject,
                    pindaRole: identity.role,
                    id: identity.subject,
                    name: local.name,
                    email: local.email,
                    emailVerified: local.emailVerified,
                  };
                },
                accountSubject: ({ profile }) =>
                  keycloakAccountId(
                    env.keycloak.enabled ? env.keycloak.issuer : "",
                    profile.sub,
                  ),
              },
            ],
          }),
        ]
      : [],
    emailAndPassword: {
      enabled: false,
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
      validateUserInfo: ({ source }) => {
        if (source.oauth?.providerId !== "keycloak") return;
        const profile = source.oauth.profile;
        if (!env.keycloak.enabled || profile?.iss !== env.keycloak.issuer)
          return {
            error: "access_denied",
            errorDescription: "Acesso institucional não autorizado.",
          };
      },
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
      useSecureCookies: env.APP_URL.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: { "/sign-in/social": { window: 60, max: 5 } },
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
