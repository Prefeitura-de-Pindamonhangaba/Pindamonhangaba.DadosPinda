import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import { createUserRepository } from "../src/modules/users/models/user-repository";
import { provisionUser } from "../src/modules/users/services/provision-user-service";
import { manageUser } from "../src/modules/users/services/manage-user-service";
import {
  user,
  session,
  rateLimit,
} from "../src/modules/auth/models/auth-schema";
import { auditEvent } from "../src/modules/audit/models/audit-schema";

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL!;
if (!new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error("Banco de teste obrigatório.");
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
  const anonymous = await request.get("/", { maxRedirects: 0 });
  const brand = await request.get("/brand/prefeitura-pindamonhangaba.svg", {
    maxRedirects: 0,
  });
  expect(brand.status()).toBe(200);
  expect(brand.headers()["content-type"]).toContain("image/svg+xml");
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

test("cadastro público e origem externa são bloqueados", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/auth/sign-up/email", {
        data: { name: "Intruso", email, password },
        headers: { origin },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/auth/sign-in/email", {
        data: { email, password },
        headers: { origin: "https://externo.example.org" },
      })
    ).status(),
  ).toBe(403);
});

test("login e saída pelo navegador revogam a sessão", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page
        .getByRole("img", {
          name: "Prefeitura Municipal de Pindamonhangaba",
          exact: true,
        })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: ".local/identity-login.png", fullPage: true });
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-incorreta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Entrar no sistema" }).getByRole("alert"),
  ).toContainText("E-mail ou senha inválidos");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(origin + "/");
  await expect(
    page.getByRole("link", { name: "Início", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: ".local/identity-home.png", fullPage: true });
  await expect(
    page.getByText("Servidor de teste", { exact: true }),
  ).toBeVisible();
  const cookies = await context.cookies();
  const cookie = cookies.find((item) => item.name.endsWith("session_token"));
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  const previousCookie = cookies
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  const replay = await page.request.get("/", {
    headers: { cookie: previousCookie },
    maxRedirects: 0,
  });
  expect(replay.status()).toBe(307);
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

test("sessão expirada e usuário desativado perdem acesso", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  await db.update(user).set({ enabled: false }).where(eq(user.id, userId));
  expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(307);
  expect(
    (
      await request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(401);
  await db.update(user).set({ enabled: true }).where(eq(user.id, userId));
  await db
    .update(session)
    .set({ expiresAt: new Date(0) })
    .where(eq(session.userId, userId));
  expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(307);
});

test("limita tentativas repetidas de login", async ({ request }) => {
  for (let i = 0; i < 5; i++) {
    const result = await request.post("/api/auth/sign-in/email", {
      headers: { origin, "x-real-ip": "127.0.0.2" },
      data: { email, password: "incorreta" },
    });
    expect(result.status()).toBe(401);
  }
  const blocked = await request.post("/api/auth/sign-in/email", {
    headers: { origin, "x-real-ip": "127.0.0.2" },
    data: { email, password },
  });
  expect(blocked.status()).toBe(429);
});

test("redefinir senha e desativar conta revogam as sessões", async ({
  request,
}) => {
  const repository = createUserRepository(db);
  const login = () =>
    request.post("/api/auth/sign-in/email", {
      headers: { origin },
      data: { email, password },
    });
  expect((await login()).status()).toBe(200);
  const newPassword = "Outra-senha-exclusiva-de-testes-123";
  await manageUser(repository, {
    action: "reset-password",
    email,
    password: newPassword,
  });
  expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(307);
  expect((await login()).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password: newPassword },
      })
    ).status(),
  ).toBe(200);
  await manageUser(repository, { action: "disable", email });
  expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(307);
  const events = await db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.userId, userId));
  expect(events.map((event) => event.action)).toEqual(
    expect.arrayContaining(["user.password_reset", "user.disabled"]),
  );
});
