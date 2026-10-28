import { createHash, generateKeyPairSync, sign, randomUUID } from "node:crypto";

// Provedor fictício exclusivo do Playwright, limitado a loopback e ao cliente de teste.
const issuer = "http://127.0.0.1:3102/realms/test";
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
  { subject: string; nonce: string; challenge: string }
>();
Bun.serve({
  hostname: "127.0.0.1",
  port: 3102,
  async fetch(request) {
    const url = new URL(request.url);
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
          "http://localhost:3101/api/auth/callback/keycloak" ||
        url.searchParams.get("code_challenge_method") !== "S256"
      )
        return new Response("Invalid client", { status: 400 });
      const code = randomUUID();
      codes.set(code, {
        subject: url.searchParams.get("login_hint") || "unlinked",
        nonce: url.searchParams.get("nonce") || "",
        challenge: url.searchParams.get("code_challenge") || "",
      });
      const callback = new URL(
        "http://localhost:3101/api/auth/callback/keycloak",
      );
      callback.searchParams.set("code", code);
      callback.searchParams.set("state", url.searchParams.get("state") || "");
      return Response.redirect(callback);
    }
    if (url.pathname === "/realms/test/token" && request.method === "POST") {
      const body = new URLSearchParams(await request.text());
      const code = body.get("code") || "";
      const entry = codes.get(code);
      codes.delete(code);
      if (
        !entry ||
        createHash("sha256")
          .update(body.get("code_verifier") || "")
          .digest("base64url") !== entry.challenge
      )
        return new Response("Invalid code", { status: 400 });
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: issuer,
        aud: "pinda-e2e",
        sub: entry.subject,
        email: `${entry.subject}@example.org`,
        email_verified: true,
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
