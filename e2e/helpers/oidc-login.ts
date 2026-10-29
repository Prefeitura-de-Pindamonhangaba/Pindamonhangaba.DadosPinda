import { expect, type APIRequestContext } from "@playwright/test";
export const testIssuer = "http://127.0.0.1:3102/realms/test";
export async function signInTestUser(
  request: APIRequestContext,
  subject: string,
  role = "viewer",
  name = "Servidor de teste",
) {
  const start = await request.post("/api/auth/sign-in/social", {
    headers: { origin: "http://localhost:3101" },
    data: {
      provider: "keycloak",
      callbackURL: "/",
      errorCallbackURL: "/login?sso=error",
    },
  });
  expect(start.status()).toBe(200);
  const url = new URL((await start.json()).url);
  expect(url.origin).toBe("http://127.0.0.1:3102");
  url.searchParams.set(
    "login_hint",
    Buffer.from(JSON.stringify({ subject, role, name })).toString("base64url"),
  );
  const authorization = await request.get(url.toString(), { maxRedirects: 0 });
  const callback = authorization.headers().location;
  expect(callback).toContain(
    "http://localhost:3101/api/auth/callback/keycloak?",
  );
  const completed = await request.get(callback, { maxRedirects: 0 });
  expect(completed.status()).toBe(302);
  const session = await request.get("/api/auth/get-session");
  expect(session.status()).toBe(200);
  const principal = (await session.json())?.user;
  expect(principal?.id).toBeTruthy();
  return principal.id as string;
}
