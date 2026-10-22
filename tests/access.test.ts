import { describe, expect, test } from "bun:test";
import { canAccess } from "../src/modules/auth/services/access-service";
import { provisionUserSchema } from "../src/modules/auth/schemas/login-schema";
import { parseAuthEnvironment } from "../src/shared/lib/env";

describe("controle de acesso", () => {
  const principal = {
    id: crypto.randomUUID(),
    name: "Servidor",
    role: "viewer",
    enabled: true,
  };
  test("nega anônimo, usuário desativado e papel desconhecido", () => {
    expect(canAccess(null, "panel:read")).toBe(false);
    expect(canAccess({ ...principal, enabled: false }, "panel:read")).toBe(
      false,
    );
    expect(canAccess({ ...principal, role: "unknown" }, "panel:read")).toBe(
      false,
    );
    expect(canAccess({ ...principal, role: "constructor" }, "panel:read")).toBe(
      false,
    );
  });
  test("autoriza somente permissão concedida ao papel", () => {
    expect(canAccess(principal, "panel:read")).toBe(true);
    expect(canAccess({ ...principal, role: "admin" }, "panel:read")).toBe(true);
  });
  test("provisionamento valida senha, papel e normaliza e-mail", () => {
    expect(
      provisionUserSchema.safeParse({
        name: "Servidor",
        email: "teste@example.org",
        password: "curta",
      }).success,
    ).toBe(false);
    expect(
      provisionUserSchema.parse({
        name: "Servidor",
        email: "TESTE@example.org",
        password: "uma-senha-longa-de-teste",
      }).email,
    ).toBe("teste@example.org");
  });
  test("segredo obrigatório sem exposição no erro", () => {
    expect(() =>
      parseAuthEnvironment({
        APP_URL: "http://localhost:3001",
        DATABASE_URL: "postgresql://localhost/test",
        BETTER_AUTH_SECRET: "segredo-curto",
      }),
    ).toThrow("Configuração de ambiente inválida: BETTER_AUTH_SECRET.");
  });
});
