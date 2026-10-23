import { describe, expect, test } from "bun:test";
import { parseEnvironment } from "../src/shared/lib/env";

const valid = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:secret@localhost:5432/test",
};

describe("configuração do ambiente", () => {
  test("aceita desenvolvimento e PostgreSQL", () => {
    expect(parseEnvironment(valid).NODE_ENV).toBe("development");
  });
  test("rejeita configuração ausente sem expor segredos", () => {
    expect(() => parseEnvironment({ DATABASE_URL: "secret" })).toThrow(
      "Configuração de ambiente inválida: APP_URL, DATABASE_URL.",
    );
  });
  test("exige HTTPS em produção", () => {
    expect(() =>
      parseEnvironment({ ...valid, NODE_ENV: "production" }),
    ).toThrow("APP_URL");
    expect(
      parseEnvironment({
        ...valid,
        NODE_ENV: "production",
        APP_URL: "https://dados.example.org",
      }).NODE_ENV,
    ).toBe("production");
  });
  test("rejeita protocolos incompatíveis", () => {
    expect(() =>
      parseEnvironment({ ...valid, DATABASE_URL: "https://example.org" }),
    ).toThrow("DATABASE_URL");
  });
});

test("HTTP local exige autorização explícita e não libera hosts remotos", () => {
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://test:test@localhost/test",
    ALLOW_LOCAL_HTTP: "true",
  };
  expect(
    parseEnvironment({ ...base, APP_URL: "http://localhost:3000" }).APP_URL,
  ).toBe("http://localhost:3000");
  for (const APP_URL of [
    "http://example.org",
    "http://localhost.example.org",
    "http://localhost@example.org",
  ]) {
    expect(() => parseEnvironment({ ...base, APP_URL })).toThrow();
  }
});
