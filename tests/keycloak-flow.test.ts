import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { and, eq, inArray } from "drizzle-orm";
import { createAuthService } from "../src/modules/auth/services/auth-service";
import { parseAuthEnvironment } from "../src/shared/lib/env";
import { createUserRepository } from "../src/modules/users/models/user-repository";
import { provisionUser } from "../src/modules/users/services/provision-user-service";
import { manageKeycloakBinding } from "../src/modules/users/services/keycloak-binding-service";
import { createKeycloakBindingRepository } from "../src/modules/users/models/keycloak-binding-repository";
import { account, user } from "../src/modules/auth/models/auth-schema";
import { auditEvent } from "../src/modules/audit/models/audit-schema";

const databaseUrl = process.env.KEYCLOAK_TEST_DATABASE_URL;
if (
  databaseUrl &&
  (!new URL(databaseUrl).pathname.endsWith("_test") ||
    !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname))
)
  throw new Error(
    "KEYCLOAK_TEST_DATABASE_URL exige banco local isolado com sufixo _test.",
  );
const identityTest = test.skipIf(!databaseUrl);
const client = databaseUrl
  ? postgres(databaseUrl, { max: 5, onnotice: () => {} })
  : undefined;
const db = client ? drizzle(client) : undefined;
const issuer = "https://keycloak.example.test/realms/pinda";
const base = "https://pinda.example.test";
const ids: string[] = [];
let adminId: string, targetId: string;
const email = `oidc-${crypto.randomUUID()}@example.org`;
const env = databaseUrl
  ? parseAuthEnvironment({
      NODE_ENV: "test",
      APP_URL: base,
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: "isolated-keycloak-test-secret-not-production",
      KEYCLOAK_ENABLED: "true",
      KEYCLOAK_ISSUER: issuer,
      KEYCLOAK_CLIENT_ID: "pinda",
      KEYCLOAK_CLIENT_SECRET: "fictitious-client-secret",
    })
  : undefined;

beforeAll(async () => {
  if (!db) return;
  await migrate(db, { migrationsFolder: "drizzle" });
  const repository = createUserRepository(db);
  for (const [name, role, address] of [
    ["Admin fictício", "admin", `admin-${email}`],
    ["Operador fictício", "operator", email],
  ] as const) {
    const created = await provisionUser(repository, {
      name,
      email: address,
      password: "Fictitious-test-password-123",
      role,
    });
    ids.push(created.id);
  }
  [adminId, targetId] = ids;
  await manageKeycloakBinding(
    createKeycloakBindingRepository(db),
    {
      action: "link",
      actorId: adminId,
      userId: targetId,
      subject: "stable-subject",
    },
    env!.keycloak,
  );
});
afterAll(async () => {
  if (!db || !client) return;
  await db.delete(auditEvent).where(inArray(auditEvent.userId, ids));
  await db.delete(user).where(inArray(user.id, ids));
  await client.end();
});

identityTest(
  "vínculos exigem administrador e impedem reatribuir identidade de outra conta",
  async () => {
    const repository = createKeycloakBindingRepository(db!);
    await expect(
      manageKeycloakBinding(
        repository,
        { action: "unlink", actorId: targetId, userId: adminId },
        env!.keycloak,
      ),
    ).rejects.toThrow("Administrador");
    await expect(
      manageKeycloakBinding(
        repository,
        {
          action: "link",
          actorId: adminId,
          userId: adminId,
          subject: "stable-subject",
        },
        env!.keycloak,
      ),
    ).rejects.toThrow();
    const [bound] = await db!
      .select({ userId: account.userId })
      .from(account)
      .where(
        and(eq(account.providerId, "keycloak"), eq(account.userId, targetId)),
      );
    expect(bound.userId).toBe(targetId);
  },
);

identityTest(
  "OIDC assinado: PKCE, sessão, identidade explícita, criptografia, replay e claims inválidas",
  async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const jwk = {
      ...publicKey.export({ format: "jwk" }),
      kid: "test-key",
      alg: "RS256",
      use: "sig",
    };
    let nonce = "",
      challenge = "",
      mode = "valid",
      exchanges = 0;
    const fakeFetch = Object.assign(
      async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url === issuer + "/.well-known/openid-configuration")
          return Response.json({
            issuer,
            authorization_endpoint: issuer + "/auth",
            token_endpoint: issuer + "/token",
            jwks_uri: issuer + "/certs",
            id_token_signing_alg_values_supported: ["RS256"],
            response_types_supported: ["code"],
            subject_types_supported: ["public"],
          });
        if (url === issuer + "/certs") return Response.json({ keys: [jwk] });
        if (url === issuer + "/token") {
          exchanges++;
          const body = new URLSearchParams(String(init?.body));
          expect(
            createHash("sha256")
              .update(body.get("code_verifier")!)
              .digest("base64url"),
          ).toBe(challenge);
          const now = Math.floor(Date.now() / 1000);
          const claims = {
            iss:
              mode === "issuer"
                ? "https://other.example.test/realms/pinda"
                : issuer,
            aud: mode === "audience" ? "other-client" : "pinda",
            sub: ["unlinked", "new_user"].includes(mode)
              ? "other-subject"
              : "stable-subject",
            email: mode === "new_user" ? "unprovisioned@example.test" : email,
            email_verified: mode !== "unverified",
            name: "Nome remoto",
            nonce: mode === "nonce" ? "forged" : nonce,
            iat: now,
            exp: mode === "expired" ? now - 100 : now + 300,
            role: "admin",
            realm_access: { roles: ["admin"] },
          };
          const data =
            Buffer.from(
              JSON.stringify({ alg: "RS256", kid: "test-key" }),
            ).toString("base64url") +
            "." +
            Buffer.from(JSON.stringify(claims)).toString("base64url");
          const token =
            data +
            "." +
            sign("RSA-SHA256", Buffer.from(data), privateKey).toString(
              "base64url",
            );
          return Response.json({
            access_token: "plain-test-access-token",
            refresh_token: "plain-test-refresh-token",
            token_type: "Bearer",
            expires_in: 300,
            id_token: token,
          });
        }
        throw new Error("Rede externa inesperada no teste OIDC.");
      },
      { preconnect: globalThis.fetch.preconnect },
    );
    const fetchMock = spyOn(globalThis, "fetch").mockImplementation(fakeFetch);
    try {
      const auth = createAuthService(db!, env!);
      const localLogin = await auth.handler(
        new Request(base + "/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: base },
          body: JSON.stringify({
            email,
            password: "Fictitious-test-password-123",
          }),
        }),
      );
      expect(localLogin.ok).toBe(false);
      expect(
        localLogin.headers
          .getSetCookie()
          .some(
            (c) => c.includes("session_token=") && !c.includes("Max-Age=0"),
          ),
      ).toBe(false);
      let loginNumber = 0;
      const testSubnet = Math.floor(Math.random() * 255);
      async function login() {
        const ip = `198.18.${testSubnet}.${++loginNumber}`;
        const start = await auth.handler(
          new Request(base + "/api/auth/sign-in/social", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: base,
              "x-real-ip": ip,
            },
            body: JSON.stringify({
              provider: "keycloak",
              callbackURL: "/",
              errorCallbackURL: "/login?sso=error",
            }),
          }),
        );
        expect(start.status).toBe(200);
        const redirect = new URL((await start.json()).url);
        nonce = redirect.searchParams.get("nonce")!;
        challenge = redirect.searchParams.get("code_challenge")!;
        expect(redirect.searchParams.get("code_challenge_method")).toBe("S256");
        expect(nonce).toBeTruthy();
        const cookie = start.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; ");
        const callback =
          base +
          "/api/auth/callback/keycloak?code=fictitious&state=" +
          encodeURIComponent(redirect.searchParams.get("state")!);
        return {
          callback,
          cookie,
          response: await auth.handler(
            new Request(callback, { headers: { cookie, "x-real-ip": ip } }),
          ),
        };
      }
      const successful = await login();
      expect(successful.response.status).toBe(302);
      const sessionCookie = successful.response.headers
        .getSetCookie()
        .filter(
          (c) => c.includes("session_token=") && !c.includes("Max-Age=0"),
        );
      expect(sessionCookie.length).toBeGreaterThan(0);
      const principal = await auth.api.getSession({
        headers: new Headers({
          cookie: sessionCookie.map((c) => c.split(";")[0]).join("; "),
        }),
      });
      expect(principal?.user.id).toBe(targetId);
      expect(principal?.user.role).toBe("operator");
      const [stored] = await db!
        .select()
        .from(account)
        .where(
          and(eq(account.providerId, "keycloak"), eq(account.userId, targetId)),
        );
      expect(stored.accessToken).not.toBe("plain-test-access-token");
      expect(stored.refreshToken).not.toBe("plain-test-refresh-token");
      const count = exchanges;
      await auth.handler(
        new Request(successful.callback, {
          headers: { cookie: successful.cookie },
        }),
      );
      expect(exchanges).toBe(count);
      for (const value of [
        "unlinked",
        "new_user",
        "unverified",
        "issuer",
        "audience",
        "nonce",
        "expired",
      ]) {
        mode = value;
        const denied = await login();
        expect(
          denied.response.headers
            .getSetCookie()
            .some(
              (c) => c.includes("session_token=") && !c.includes("Max-Age=0"),
            ),
        ).toBe(false);
      }
      mode = "valid";
      await db!
        .update(user)
        .set({ enabled: false })
        .where(eq(user.id, targetId));
      const disabled = await login();
      expect(
        disabled.response.headers
          .getSetCookie()
          .some(
            (c) => c.includes("session_token=") && !c.includes("Max-Age=0"),
          ),
      ).toBe(false);
    } finally {
      fetchMock.mockRestore();
    }
  },
);
