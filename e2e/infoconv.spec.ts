import { test, expect, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq, inArray, like, or, sql } from "drizzle-orm";
import { provisionUser } from "../src/modules/users/services/provision-user-service";
import { createUserRepository } from "../src/modules/users/models/user-repository";
import { user, rateLimit } from "../src/modules/auth/models/auth-schema";
import { auditEvent } from "../src/modules/audit/models/audit-schema";
import {
  consultationAudit,
  consultationCache,
} from "../src/modules/consultations/models/consultation-schema";
import {
  referenceType,
  referenceValue,
} from "../src/modules/reference-data/models/reference-schema";
import {
  encryptCache,
  documentDigest,
  cacheContext,
} from "../src/modules/consultations/services/cache-crypto";
import { parseInfoconvEnvironment } from "../src/modules/data-sources/infoconv/env";
import { withDocumentLock } from "../src/modules/consultations/models/consultation-repository";
import { consultDocument } from "../src/modules/consultations/services/consultation-service";
import { consultationSchema } from "../src/modules/consultations/schemas/consultation-schema";
import type { Role } from "../src/modules/auth/permissions";

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL!;
if (
  !databaseUrl ||
  !new URL(databaseUrl).pathname.endsWith("_test") ||
  !["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)
)
  throw new Error("Banco local de teste obrigatório.");
const client = postgres(databaseUrl, { max: 4, onnotice: () => {} });
const db = drizzle(client);
const origin = "http://localhost:3101";
const runId = crypto.randomUUID();
const password = "Senha-ficticia-exclusiva-testes-123";
const users: Record<string, { id: string; email: string; role: Role }> = {};
const cacheKeys: string[] = [];
const referenceCode = `TEST_${runId.slice(0, 8).toUpperCase()}`;
const env = parseInfoconvEnvironment({
  INFOCONV_ENABLED: "false",
  INFOCONV_CERTIFICATE_PATH: "nonexistent-test.pem",
  INFOCONV_REQUESTER_CPF: "11144477735",
  INFOCONV_CPF_WSDL:
    "https://acesso.infoconv.receita.fazenda.gov.br/ws/cpf/consultarcpf.asmx?wsdl",
  INFOCONV_CNPJ_WSDL:
    "https://acesso.infoconv.receita.fazenda.gov.br/ws/cnpj/consultarcnpj.asmx?wsdl",
  INFOCONV_CACHE_KEY: "ab".repeat(32),
  INFOCONV_AUDIT_KEY: "cd".repeat(32),
});
const cachedDocument = "11144477735";
const cachedKey = `cpf:${documentDigest(env.INFOCONV_AUDIT_KEY, "cpf", cachedDocument)}`;
const payload = (document = cachedDocument) => ({
  kind: "cpf",
  document,
  purpose: "Processo administrativo fictício de teste",
  batchId: crypto.randomUUID(),
});

async function login(request: APIRequestContext, role = "operator") {
  const response = await request.post("/api/auth/sign-in/email", {
    headers: { origin },
    data: { email: users[role].email, password },
  });
  expect(response.status()).toBe(200);
}

test.beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.delete(consultationCache);
  await db.delete(consultationAudit);
  for (const role of ["viewer", "operator", "admin"] as const) {
    const email = `e2e-infoconv-${runId}-${role}@example.org`;
    const created = await provisionUser(createUserRepository(db), {
      name: `Servidor fictício ${role}`,
      email,
      role,
      password,
    });
    users[role] = { id: created.id, email, role };
  }
  cacheKeys.push(cachedKey);
});

test.beforeEach(async () => {
  await db.delete(rateLimit);
  await db
    .delete(consultationCache)
    .where(eq(consultationCache.key, cachedKey));
});

test.afterAll(async () => {
  const createdUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.email, `e2e-infoconv-${runId}%`));
  const ids = createdUsers.map((item) => item.id);
  if (ids.length) {
    await db
      .delete(consultationAudit)
      .where(inArray(consultationAudit.userId, ids));
    await db
      .delete(auditEvent)
      .where(
        or(inArray(auditEvent.userId, ids), inArray(auditEvent.actorId, ids)),
      );
    await db.delete(user).where(inArray(user.id, ids));
  }
  if (cacheKeys.length)
    await db
      .delete(consultationCache)
      .where(inArray(consultationCache.key, cacheKeys));
  await db.delete(referenceValue).where(eq(referenceValue.type, referenceCode));
  await db.delete(referenceType).where(eq(referenceType.code, referenceCode));
  await client.end();
});

test("permissões, finalidade e origem são verificadas no servidor", async ({
  request,
}) => {
  await login(request, "viewer");
  expect(
    (
      await request.post("/api/consultations", {
        headers: { origin },
        data: payload(),
      })
    ).status(),
  ).toBe(403);
  await request.post("/api/auth/sign-out", { headers: { origin }, data: {} });
  await login(request);
  expect(
    (
      await request.post("/api/consultations", {
        headers: { origin },
        data: { ...payload(), purpose: "curta" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/consultations", {
        headers: { origin: "https://externo.example.org" },
        data: payload(),
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/consultations", {
        headers: { origin },
        data: { ...payload(), forceRefresh: true },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/admin/users")).status()).toBe(403);
});

test("cache criptografado é reutilizado sem chamar o adapter de teste", async ({
  request,
}) => {
  const obtainedAt = new Date();
  const expiresAt = new Date(obtainedAt.getTime() + 604800000);
  await db.insert(consultationCache).values({
    key: cachedKey,
    kind: "cpf",
    ciphertext: encryptCache(
      env.INFOCONV_CACHE_KEY,
      cacheContext(cachedKey, obtainedAt, expiresAt),
      {
        CPF: cachedDocument,
        Nome: "BASE LOCAL FICTÍCIA",
      },
    ),
    obtainedAt,
    expiresAt,
  });
  await login(request);
  const first = await request.post("/api/consultations", {
    headers: { origin },
    data: payload(),
  });
  expect(first.status()).toBe(200);
  const result = await first.json();
  expect(result.origin).toBe("cache");
  expect(result.data.Nome).toBe("BASE LOCAL FICTÍCIA");
  const second = await request.post("/api/consultations", {
    headers: { origin },
    data: payload(),
  });
  expect((await second.json()).origin).toBe("cache");
  const records = await db
    .select()
    .from(consultationAudit)
    .where(eq(consultationAudit.id, result.id));
  expect(JSON.stringify(records)).not.toContain(cachedDocument);
  expect(records[0].origin).toBe("cache");
  const exportResponse = await request.post("/api/consultations/disclose", {
    headers: { origin },
    data: { format: "csv", results: [result] },
  });
  expect(exportResponse.status()).toBe(200);
  expect(await exportResponse.text()).toContain("BASE LOCAL FICTÍCIA");
  expect(
    (
      await request.post("/api/consultations/disclose", {
        headers: { origin },
        data: {
          format: "csv",
          results: [{ ...result, data: { Nome: "alterado" } }],
        },
      })
    ).status(),
  ).toBe(403);
});

test("consultas concorrentes compartilham cache e limite mensal mantém cache acessível", async () => {
  const principal = {
    id: users.admin.id,
    name: "Administrador fictício",
    role: "admin",
    enabled: true,
  };
  let calls = 0;
  const adapter = {
    async consult(_kind: string, document: string) {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { data: { CPF: document, Nome: "CONCORRÊNCIA FICTÍCIA" } };
    },
  };
  const input = consultationSchema.parse(payload("12345678909"));
  const key = documentDigest(
    env.INFOCONV_AUDIT_KEY,
    input.kind,
    input.document,
  );
  cacheKeys.push(`cpf:${key}`);
  const results = await Promise.all(
    [1, 2].map(() =>
      withDocumentLock(db, key, (repository) =>
        consultDocument(repository, adapter, env, principal, input),
      ),
    ),
  );
  expect(calls).toBe(1);
  expect(results.map((item) => item.origin).sort()).toEqual([
    "cache",
    "serpro",
  ]);
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(consultationAudit)
    .where(eq(consultationAudit.origin, "serpro"));
  const limited = { ...env, INFOCONV_MONTHLY_LIMIT: count.count };
  const fromCache = await withDocumentLock(db, key, (repository) =>
    consultDocument(repository, adapter, limited, principal, input),
  );
  expect(fromCache.origin).toBe("cache");
  const otherInput = consultationSchema.parse(payload("93541134780"));
  const otherKey = documentDigest(
    env.INFOCONV_AUDIT_KEY,
    otherInput.kind,
    otherInput.document,
  );
  await expect(
    withDocumentLock(db, otherKey, (repository) =>
      consultDocument(repository, adapter, limited, principal, otherInput),
    ),
  ).rejects.toThrow("monthly_limit");
  expect(calls).toBe(1);
});

test("lote TXT, erros por item e exportação funcionam no navegador", async ({
  page,
}) => {
  await login(page.request);
  await page.goto("/consultations");
  await page.getByLabel("Modalidade", { exact: true }).selectOption("batch");
  await page.getByLabel("Importar arquivo TXT", { exact: true }).setInputFiles({
    name: "ficticios.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("11144477735\n11144477735\n52998224725"),
  });
  await page
    .getByLabel("Finalidade administrativa", { exact: true })
    .fill("Fiscalização fictícia no ambiente de teste");
  await page.getByRole("button", { name: "Consultar", exact: true }).click();
  await expect(
    page.getByText("2 de 2 documento(s) processado(s).", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("PESSOA FICTÍCIA — TESTE", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sem resultado", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("infoconv-cpf");
  await page.screenshot({
    path: ".local/infoconv-batch-preview.png",
    fullPage: true,
  });
});

test("CNPJ exibe CNAE e quadro societário", async ({ page }) => {
  await login(page.request);
  await page.goto("/consultations");
  await page
    .getByLabel("Tipo de documento", { exact: true })
    .selectOption("cnpj");
  await page.getByLabel("CNPJ", { exact: true }).fill("04.252.011/0001-10");
  await page
    .getByLabel("Finalidade administrativa", { exact: true })
    .fill("Análise cadastral fictícia de teste");
  await page.getByRole("button", { name: "Consultar", exact: true }).click();
  await expect(
    page.getByText("EMPRESA FICTÍCIA — TESTE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quadro societário", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("SÓCIO FICTÍCIO", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/infoconv-mobile-preview.png",
    fullPage: true,
  });
});

test("administração de servidores e domínios registra alterações e respeita vínculos", async ({
  request,
}) => {
  await login(request, "admin");
  const managedEmail = `e2e-infoconv-${runId}-managed@example.org`;
  const created = await request.post("/api/admin/users", {
    headers: { origin },
    data: {
      name: "Servidor importado fictício",
      email: managedEmail,
      role: "operator",
      password,
    },
  });
  expect(created.status()).toBe(201);
  const target = await created.json();
  expect(
    (
      await request.patch("/api/admin/users", {
        headers: { origin },
        data: {
          id: target.id,
          name: "Servidor alterado fictício",
          email: managedEmail,
          role: "viewer",
          enabled: false,
        },
      })
    ).status(),
  ).toBe(200);
  const response = await request.get("/api/admin/users?format=csv");
  expect(response.status()).toBe(200);
  expect(await response.text()).not.toContain(password);
  expect(
    (
      await request.post("/api/admin/references", {
        headers: { origin },
        data: {
          action: "save-type",
          item: { code: referenceCode, label: "Tipo fictício" },
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/admin/references", {
        headers: { origin },
        data: {
          action: "save-value",
          item: {
            type: referenceCode,
            code: "001",
            label: "Descrição fictícia",
          },
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/admin/references", {
        headers: { origin },
        data: { action: "delete-type", code: referenceCode },
      })
    ).status(),
  ).toBe(409);
  const rows = await db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.actorId, users.admin.id));
  expect(rows.map((row) => row.action)).toEqual(
    expect.arrayContaining([
      "user.provisioned",
      "user.access_updated",
      "reference.save-type",
      "reference.save-value",
    ]),
  );
});

test("troca de senha valida a atual e mantém as credenciais fora da resposta", async ({
  request,
}) => {
  await login(request, "viewer");
  const changed = await request.post("/api/auth/change-password", {
    headers: { origin },
    data: {
      currentPassword: password,
      newPassword: "Nova-senha-ficticia-de-testes-456",
      revokeOtherSessions: true,
    },
  });
  expect(changed.status()).toBe(200);
  expect(await changed.text()).not.toContain(password);
  const events = await db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.userId, users.viewer.id));
  expect(events.map((event) => event.action)).toContain(
    "user.credentials_updated",
  );
});
