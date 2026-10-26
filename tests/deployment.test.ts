import { describe, expect, test } from "bun:test";
import { resolveDeployment } from "../src/shared/lib/deployment/config";
import { checkIntegrationConfiguration } from "../src/shared/lib/deployment/preflight";

const base = {
  COMPOSE_PROFILES: "development",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "a".repeat(48),
  POSTGRES_USER: "pinda",
  POSTGRES_PASSWORD: "senha:@/?#",
  POSTGRES_DB: "pinda_dados",
  DATABASE_URL: "postgresql://ignored:ignored@external.invalid/production",
};

describe("política de deploy", () => {
  test("dev ignora connection string externa e codifica credenciais do banco local", () => {
    const config = resolveDeployment(base);
    const url = new URL(config.databaseUrl);
    expect(url.hostname).toBe("db");
    expect(decodeURIComponent(url.password)).toBe(base.POSTGRES_PASSWORD);
    expect(config.environment.ALLOW_LOCAL_HTTP).toBe("true");
  });
  test("produção usa exclusivamente a connection string externa e preserva TLS", () => {
    const DATABASE_URL =
      "postgresql://user:private@database.example.org/dados?sslmode=require";
    const config = resolveDeployment({
      ...base,
      COMPOSE_PROFILES: "production",
      APP_URL: "https://dados.example.org",
      DATABASE_URL,
      POSTGRES_PASSWORD: "",
    });
    expect(config.databaseUrl).toBe(DATABASE_URL);
    expect(config.environment.ALLOW_LOCAL_HTTP).toBe("false");
  });
  test("não aceita modos combinados, vazio ou desconhecido", () => {
    for (const COMPOSE_PROFILES of [
      "",
      "development,production",
      "prod",
      undefined,
    ])
      expect(() => resolveDeployment({ ...base, COMPOSE_PROFILES })).toThrow(
        "COMPOSE_PROFILES",
      );
  });
  test("informa variáveis ausentes em conjunto sem revelar valores", () => {
    expect(() =>
      resolveDeployment({
        ...base,
        APP_URL: "",
        POSTGRES_PASSWORD: "",
        BETTER_AUTH_SECRET: "private",
      }),
    ).toThrow("APP_URL, BETTER_AUTH_SECRET");
    try {
      resolveDeployment({
        ...base,
        COMPOSE_PROFILES: "production",
        DATABASE_URL: "private-invalid-secret",
      });
    } catch (error) {
      expect(String(error)).not.toContain("private-invalid-secret");
    }
  });
  test("produção recusa banco local, URL inválida e HTTP mesmo com exceção legada", () => {
    const prod = {
      ...base,
      COMPOSE_PROFILES: "production",
      APP_URL: "https://dados.example.org",
      ALLOW_LOCAL_HTTP: "true",
    };
    for (const DATABASE_URL of [
      "postgresql://user:private@db/dados",
      "postgresql://user:private@localhost/dados",
      "invalid",
    ])
      expect(() => resolveDeployment({ ...prod, DATABASE_URL })).toThrow(
        "DATABASE_URL",
      );
    expect(() =>
      resolveDeployment({ ...prod, APP_URL: "http://localhost:3000" }),
    ).toThrow("HTTPS");
  });
  test("Infoconv desligado dispensa credenciais, habilitado informa pendências sem chamadas", async () => {
    await expect(
      checkIntegrationConfiguration({ INFOCONV_ENABLED: "false" }),
    ).resolves.toBeUndefined();
    await expect(
      checkIntegrationConfiguration({ INFOCONV_ENABLED: "invalid" }),
    ).rejects.toThrow("INFOCONV_ENABLED");
    await expect(
      checkIntegrationConfiguration({ INFOCONV_ENABLED: "true" }),
    ).rejects.toThrow("INFOCONV_CACHE_KEY");
    await expect(
      checkIntegrationConfiguration({
        INFOCONV_ENABLED: "true",
        INFOCONV_CACHE_KEY: "ab".repeat(32),
        INFOCONV_AUDIT_KEY: "cd".repeat(32),
      }),
    ).rejects.toThrow("INFOCONV_CERTIFICATE_PATH");
  });
});
