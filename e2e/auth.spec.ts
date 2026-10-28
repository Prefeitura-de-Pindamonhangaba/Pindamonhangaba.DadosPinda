import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import { createUserRepository } from "../src/modules/users/models/user-repository";
import { provisionUser } from "../src/modules/users/services/provision-user-service";
import { manageUser } from "../src/modules/users/services/manage-user-service";
import {
  account,
  user,
  session,
  rateLimit,
} from "../src/modules/auth/models/auth-schema";
import { auditEvent } from "../src/modules/audit/models/audit-schema";
import { keycloakAccountId } from "../src/modules/auth/services/keycloak-config";
import { signInTestUser, testIssuer } from "./helpers/oidc-login";

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL!;
if (
  !databaseUrl ||
  !new URL(databaseUrl).pathname.endsWith("_test") ||
  !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
)
  throw new Error("Banco local de teste obrigatório.");
const client = postgres(databaseUrl, { max: 2, onnotice: () => {} });
const db = drizzle(client);
const email = `auth-${crypto.randomUUID()}@example.org`;
const password = "Senha-exclusiva-de-testes-123";
let userId: string;
const origin = "http://localhost:3101";
test.beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  const created = await provisionUser(createUserRepository(db), {
    name: "Servidor de teste",
    email,
    password,
  });
  userId = created.id;
  await db.insert(account).values({
    userId,
    providerId: "keycloak",
    accountId: keycloakAccountId(testIssuer, userId),
  });
});
test.beforeEach(async () => {
  await db.delete(rateLimit);
  await db.update(user).set({ enabled: true }).where(eq(user.id, userId));
});
test.afterAll(async () => {
  if (userId) {
    await db.delete(auditEvent).where(eq(auditEvent.userId, userId));
    await db.delete(user).where(eq(user.id, userId));
  }
  await client.end();
});

test("acesso direto e cookie adulterado não abrem a área interna", async ({
  request,
}) => {
  expect(
    (await request.get("/brand/prefeitura-pindamonhangaba.svg")).status(),
  ).toBe(200);
  const anonymous = await request.get("/", { maxRedirects: 0 });
  expect(anonymous.status()).toBe(307);
  expect(anonymous.headers().location).toBe("/login");
  expect(
    (await request.get("/api/internal", { maxRedirects: 0 })).status(),
  ).toBe(401);
  expect(
    (
      await request.get("/", {
        headers: { cookie: "better-auth.session_token=forged" },
        maxRedirects: 0,
      })
    ).status(),
  ).toBe(307);
});

test("login local, cadastro e recuperação local são bloqueados; SSO valida origem", async ({
  request,
}) => {
  for (const endpoint of [
    "sign-in/email",
    "sign-up/email",
    "change-password",
    "request-password-reset",
    "reset-password",
  ]) {
    const result = await request.post(`/api/auth/${endpoint}`, {
      headers: { origin },
      data: { email, password },
    });
    expect(result.status()).toBe(404);
    expect(await result.text()).not.toContain(password);
  }
  expect(
    (
      await request.post("/api/auth/sign-in/social", {
        headers: { origin: "https://externo.example.org" },
        data: { provider: "keycloak" },
      })
    ).status(),
  ).toBe(403);
});

test("apresentação tem apenas Login, redireciona ao SSO e funciona em celular", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Pinda Dados", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main button")).toHaveCount(1);
  await expect(page.locator("main input")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Login", exact: true }),
  ).toBeEnabled();
  // Intercepta apenas a navegação ao IdP fictício para inspecionar o redirecionamento.
  await page.route(
    "http://127.0.0.1:3102/realms/test/auth?**",
    async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      await route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: "<h1>Acesso institucional fictício</h1>",
      });
    },
  );
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acesso institucional fictício" }),
  ).toBeVisible();
  await page.goto("/login?sso=error");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Acesso institucional não autorizado",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Login", exact: true }),
  ).toBeVisible();
});

test("SSO assinado cria sessão; saída pelo navegador revoga e audita", async ({
  page,
  context,
}) => {
  await signInTestUser(page.request, userId);
  await page.goto("/");
  await expect(
    page.getByText("Servidor de teste", { exact: true }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Senha e recuperação de acesso" }),
  ).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const cookies = await context.cookies();
  const cookie = cookies.find((item) => item.name.endsWith("session_token"));
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  const previousCookie = cookies
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (
      await page.request.get("/", {
        headers: { cookie: previousCookie },
        maxRedirects: 0,
      })
    ).status(),
  ).toBe(307);
  const events = await db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.userId, userId));
  expect(events.map((event) => event.action)).toEqual(
    expect.arrayContaining([
      "user.provisioned",
      "session.created",
      "session.revoked",
    ]),
  );
});

test("sessão expirada e desativação revogam acesso", async ({ request }) => {
  await signInTestUser(request, userId);
  await db
    .update(session)
    .set({ expiresAt: new Date(0) })
    .where(eq(session.userId, userId));
  expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(307);
  await signInTestUser(request, userId);
  await manageUser(createUserRepository(db), { action: "disable", email });
  expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(307);
});

test("limita os inícios de SSO por IP", async ({ request }) => {
  for (let i = 0; i < 6; i++) {
    const result = await request.post("/api/auth/sign-in/social", {
      headers: { origin, "x-real-ip": "127.0.0.2" },
      data: {
        provider: "keycloak",
        callbackURL: "/",
        errorCallbackURL: "/login?sso=error",
      },
    });
    expect(result.status()).toBe(i < 5 ? 200 : 429);
  }
});
