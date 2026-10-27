import { defineConfig } from "@playwright/test";

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
if (
  !databaseUrl ||
  !new URL(databaseUrl).pathname.endsWith("_test") ||
  !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
) {
  throw new Error(
    "AUTH_TEST_DATABASE_URL deve apontar para um banco local exclusivo com sufixo _test.",
  );
}

export default defineConfig({
  timeout: 90_000,
  expect: { timeout: 30_000 },
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3101",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || "msedge",
    trace: "off",
  },
  webServer: {
    command: "bun run dev --port 3101",
    url: "http://localhost:3101/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_URL: "http://localhost:3101",
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: "isolated-e2e-only-secret-never-use-in-production",
      PLAYWRIGHT_TEST: "1",
      KEYCLOAK_ENABLED: "false",
      INFOCONV_ENABLED: "false",
      INFOCONV_CERTIFICATE_PATH: "test-only-nonexistent.pem",
      INFOCONV_CERTIFICATE_PASSPHRASE: "",
      INFOCONV_REQUESTER_CPF: "11144477735",
      INFOCONV_CA_PATH: "",
      INFOCONV_CPF_WSDL:
        "https://acesso.infoconv.receita.fazenda.gov.br/ws/cpf/consultarcpf.asmx?wsdl",
      INFOCONV_CNPJ_WSDL:
        "https://acesso.infoconv.receita.fazenda.gov.br/ws/cnpj/consultarcnpj.asmx?wsdl",
      INFOCONV_CACHE_KEY: "ab".repeat(32),
      INFOCONV_AUDIT_KEY: "cd".repeat(32),
    },
  },
});
