import { parseKeycloakIdentity } from "../src/modules/auth/services/keycloak-identity";
import { createKeycloakSessionService } from "../src/modules/auth/services/keycloak-session-service";
import { createKeycloakIdentityRepository } from "../src/modules/auth/models/keycloak-identity-repository";
import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { and, eq, inArray } from "drizzle-orm";
import { createAuthService } from "../src/modules/auth/services/auth-service";
import { parseAuthEnvironment } from "../src/shared/lib/env";
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
let targetId: string;
const subject = `subject-${crypto.randomUUID()}`;
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
  const [legacy] = await db
    .insert(user)
    .values({
      name: "Administrador legado sem vínculo",
      email,
      role: "admin",
      enabled: true,
    })
    .returning();
  ids.push(legacy.id);
});
afterAll(async () => {
  if (!db || !client) return;
  await db.delete(auditEvent).where(inArray(auditEvent.userId, ids));
  await db.delete(user).where(inArray(user.id, ids));
  await client.end();
});

identityTest(
  "Keycloak controla provisionamento, papéis e revogação; SDK valida OIDC sem exigir e-mail",
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
          if (body.get("grant_type") === "refresh_token") {
            expect(body.get("refresh_token")).toBe("plain-test-refresh-token");
            if (mode === "revoked")
              return Response.json({ error: "invalid_grant" }, { status: 400 });
          } else {
            expect(
              createHash("sha256")
                .update(body.get("code_verifier")!)
                .digest("base64url"),
            ).toBe(challenge);
          }
          const now = Math.floor(Date.now() / 1000);
          const claims = {
            iss:
              mode === "issuer"
                ? "https://other.example.test/realms/pinda"
                : issuer,
            aud: mode === "audience" ? "other-client" : "pinda",
            sub: ["new_user", "changed_subject"].includes(mode)
              ? subject + "-new"
              : subject,
            email:
              mode === "no_email"
                ? undefined
                : mode === "different_email"
                  ? "different@example.test"
                  : mode === "new_user"
                    ? "unprovisioned@example.test"
                    : email,
            email_verified:
              mode === "no_email" ? undefined : mode !== "unverified",
            name: "Nome remoto",
            nonce: mode === "nonce" ? "forged" : nonce,
            iat: now,
            exp: mode === "expired" ? now - 100 : now + 300,
            role: "admin",
            realm_access: { roles: ["admin"] },
            resource_access:
              mode === "other_client"
                ? { other: { roles: ["admin"] } }
                : {
                    pinda: {
                      roles:
                        mode === "no_roles"
                          ? []
                          : [
                              mode === "admin"
                                ? "admin"
                                : mode === "viewer"
                                  ? "viewer"
                                  : "operator",
                            ],
                    },
                  },
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
            id_token:
              mode === "no_id_token"
                ? undefined
                : mode === "invalid_signature"
                  ? token.slice(0, token.lastIndexOf(".") + 1) +
                    "invalid-signature"
                  : token,
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
        expect(redirect.searchParams.get("scope")?.split(" ")).not.toContain(
          "email",
        );
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
      expect(principal?.user.id).toBeTruthy();
      expect(principal?.user.id).not.toBe(ids[0]);
      targetId = principal!.user.id;
      ids.push(targetId);
      expect(principal?.user.email).toEndWith("@identity.invalid");
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
      for (const value of ["unverified", "no_email", "different_email"]) {
        mode = value;
        const allowed = await login();
        const cookies = allowed.response.headers
          .getSetCookie()
          .filter(
            (c) => c.includes("session_token=") && !c.includes("Max-Age=0"),
          );
        expect(cookies.length).toBeGreaterThan(0);
        const session = await auth.api.getSession({
          headers: new Headers({
            cookie: cookies.map((c) => c.split(";")[0]).join("; "),
          }),
        });
        expect(session?.user.id).toBe(targetId);
        expect(session?.user.email).toBe(principal?.user.email);
      }
      for (const value of [
        "no_roles",
        "other_client",
        "issuer",
        "audience",
        "nonce",
        "expired",
        "invalid_signature",
        "no_id_token",
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
      const identity = parseKeycloakIdentity(
        {
          iss: issuer,
          sub: subject + "-concurrent",
          resource_access: { pinda: { roles: ["viewer"] } },
        },
        issuer,
        "pinda",
      )!;
      const repository = createKeycloakIdentityRepository(db!);
      const parallelProfiles = await Promise.all([
        repository.synchronize(identity),
        repository.synchronize(identity),
      ]);
      expect(parallelProfiles[0].id).toBe(parallelProfiles[1].id);
      ids.push(parallelProfiles[0].id);
      mode = "new_user";
      const newcomer = await login();
      const newCookies = newcomer.response.headers
        .getSetCookie()
        .filter(
          (c) => c.includes("session_token=") && !c.includes("Max-Age=0"),
        );
      const newSession = await auth.api.getSession({
        headers: new Headers({
          cookie: newCookies.map((c) => c.split(";")[0]).join("; "),
        }),
      });
      expect(newSession?.user.id).toBeTruthy();
      expect(newSession?.user.id).not.toBe(targetId);
      ids.push(newSession!.user.id);
      let checkedAt = Date.now();
      const authority = createKeycloakSessionService(
        auth,
        createKeycloakIdentityRepository(db!),
        () => checkedAt,
      );
      const originalHeaders = new Headers({
        cookie: sessionCookie.map((c) => c.split(";")[0]).join("; "),
      });
      mode = "admin";
      const previousExchanges = exchanges;
      const concurrentChecks = await Promise.all([
        authority.getPrincipal(originalHeaders),
        authority.getPrincipal(originalHeaders),
      ]);
      expect(concurrentChecks.map((p) => p?.role)).toEqual(["admin", "admin"]);
      expect(exchanges).toBe(previousExchanges + 1);
      checkedAt += 60_001;
      mode = "viewer";
      expect((await authority.getPrincipal(originalHeaders))?.role).toBe(
        "viewer",
      );
      await db!
        .update(user)
        .set({ role: "admin" })
        .where(eq(user.id, targetId));
      expect((await authority.getPrincipal(originalHeaders))?.role).toBe(
        "viewer",
      );
      mode = "admin";
      const changedLogin = await login();
      const changedHeaders = new Headers({
        cookie: changedLogin.response.headers
          .getSetCookie()
          .filter(
            (c) => c.includes("session_token=") && !c.includes("Max-Age=0"),
          )
          .map((c) => c.split(";")[0])
          .join("; "),
      });
      expect((await authority.getPrincipal(changedHeaders))?.role).toBe(
        "admin",
      );
      expect((await authority.getPrincipal(originalHeaders))?.role).toBe(
        "viewer",
      );
      checkedAt += 60_001;
      mode = "no_roles";
      expect(await authority.getPrincipal(originalHeaders)).toBeNull();
      mode = "valid";
      const renewed = await login();
      const renewedHeaders = new Headers({
        cookie: renewed.response.headers
          .getSetCookie()
          .filter(
            (c) => c.includes("session_token=") && !c.includes("Max-Age=0"),
          )
          .map((c) => c.split(";")[0])
          .join("; "),
      });
      checkedAt += 60_001;
      mode = "changed_subject";
      expect(await authority.getPrincipal(renewedHeaders)).toBeNull();
      mode = "valid";
      const last = await login();
      const lastHeaders = new Headers({
        cookie: last.response.headers
          .getSetCookie()
          .filter(
            (c) => c.includes("session_token=") && !c.includes("Max-Age=0"),
          )
          .map((c) => c.split(";")[0])
          .join("; "),
      });
      checkedAt += 60_001;
      mode = "revoked";
      expect(await authority.getPrincipal(lastHeaders)).toBeNull();
      expect(await auth.api.getSession({ headers: lastHeaders })).toBeNull();
    } finally {
      fetchMock.mockRestore();
    }
  },
);
