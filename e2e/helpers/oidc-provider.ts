import { createHash, generateKeyPairSync, sign, randomUUID } from "node:crypto";

// Provedor fictício exclusivo do Playwright, limitado a loopback e ao cliente de teste.
const issuer = process.env.E2E_ISSUER || "http://127.0.0.1:3102/realms/test";
const appUrl = process.env.E2E_APP_URL || "http://localhost:3101";
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "e2e",
  alg: "RS256",
  use: "sig",
};
const codes = new Map<
  string,
  {
    subject: string;
    nonce: string;
    challenge: string;
    role: string;
    name: string;
  }
>();
const refreshTokens = new Map<
  string,
  { subject: string; nonce: string; role: string; name: string }
>();
const disabled = new Set<string>();
Bun.serve({
  hostname: process.env.E2E_BIND_HOST || "127.0.0.1",
  port: 3102,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/test-disable" && request.method === "POST") {
      const data = (await request.json()) as { subject: string };
      disabled.add(data.subject);
      return new Response("ok");
    }
    if (url.pathname === "/health") return new Response("ok");
    if (url.href === issuer + "/.well-known/openid-configuration")
      return Response.json({
        issuer,
        authorization_endpoint: issuer + "/auth",
        token_endpoint: issuer + "/token",
        jwks_uri: issuer + "/certs",
        id_token_signing_alg_values_supported: ["RS256"],
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
      });
    if (url.href === issuer + "/certs") return Response.json({ keys: [jwk] });
    if (url.pathname === "/realms/test/auth") {
      if (
        url.searchParams.get("client_id") !== "pinda-e2e" ||
        url.searchParams.get("redirect_uri") !==
          `${appUrl}/api/auth/callback/keycloak` ||
        url.searchParams.get("code_challenge_method") !== "S256"
      )
        return new Response("Invalid client", { status: 400 });
      const code = randomUUID();
      const hint = url.searchParams.get("login_hint");
      let identity = {
        subject: "unlinked",
        role: "",
        name: "Servidor de teste",
      };
      try {
        if (hint)
          identity = JSON.parse(
            Buffer.from(hint, "base64url").toString("utf8"),
          );
      } catch {}
      codes.set(code, {
        ...identity,
        nonce: url.searchParams.get("nonce") || "",
        challenge: url.searchParams.get("code_challenge") || "",
      });
      const callback = new URL(`${appUrl}/api/auth/callback/keycloak`);
      callback.searchParams.set("code", code);
      callback.searchParams.set("state", url.searchParams.get("state") || "");
      return Response.redirect(callback);
    }
    if (url.pathname === "/realms/test/token" && request.method === "POST") {
      const body = new URLSearchParams(await request.text());
      const code = body.get("code") || "";
      const refreshing = body.get("grant_type") === "refresh_token";
      const entry = refreshing
        ? refreshTokens.get(body.get("refresh_token") || "")
        : codes.get(code);
      if (!refreshing) codes.delete(code);
      if (
        !entry ||
        disabled.has(entry.subject) ||
        (!refreshing &&
          createHash("sha256")
            .update(body.get("code_verifier") || "")
            .digest("base64url") !==
            ("challenge" in entry ? entry.challenge : undefined))
      )
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      const refreshToken = randomUUID();
      refreshTokens.set(refreshToken, entry);
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: issuer,
        aud: "pinda-e2e",
        sub: entry.subject,
        name: entry.name,
        resource_access: { "pinda-e2e": { roles: [entry.role] } },
        nonce: entry.nonce,
        iat: now,
        exp: now + 300,
      };
      const data =
        Buffer.from(JSON.stringify({ alg: "RS256", kid: "e2e" })).toString(
          "base64url",
        ) +
        "." +
        Buffer.from(JSON.stringify(claims)).toString("base64url");
      return Response.json({
        access_token: "fictitious-access-token",
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: 300,
        id_token:
          data +
          "." +
          sign("RSA-SHA256", Buffer.from(data), privateKey).toString(
            "base64url",
          ),
      });
    }
    return new Response("Not found", { status: 404 });
  },
});
