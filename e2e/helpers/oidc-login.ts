import { expect, type APIRequestContext } from "@playwright/test";
export const testIssuer = "http://127.0.0.1:3102/realms/test";
export async function signInTestUser(
  request: APIRequestContext,
  subject: string,
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
  url.searchParams.set("login_hint", subject);
  await request.get(url.toString());
  const session = await request.get("/api/auth/get-session");
  expect(session.status()).toBe(200);
  expect((await session.json())?.user?.id).toBe(subject);
}
