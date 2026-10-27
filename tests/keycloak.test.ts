import { keycloakSignInSchema } from "../src/modules/auth/schemas/keycloak-schema";
import { describe, expect, test } from "bun:test";
import {
  keycloakAccountId,
  parseKeycloakEnvironment,
} from "../src/modules/auth/services/keycloak-config";
import { manageKeycloakBinding } from "../src/modules/users/services/keycloak-binding-service";

const config = {
  KEYCLOAK_ENABLED: "true",
  KEYCLOAK_ISSUER: "https://sso.example.org/realms/pinda/",
  KEYCLOAK_CLIENT_ID: "pinda",
  KEYCLOAK_CLIENT_SECRET: "private-test-only",
};
test("Keycloak desligado não exige credenciais; habilitado valida campos sem revelar segredo", () => {
  expect(parseKeycloakEnvironment({}).enabled).toBe(false);
  expect(() => parseKeycloakEnvironment({ KEYCLOAK_ENABLED: "true" })).toThrow(
    "KEYCLOAK_ISSUER",
  );
  for (const KEYCLOAK_ISSUER of [
    "http://sso.example.org/realms/pinda",
    "https://user:secret@sso.example.org/realms/pinda",
    "https://sso.example.org/realms/pinda?secret=private",
    "https://sso.example.org/",
  ])
    expect(() =>
      parseKeycloakEnvironment({ ...config, KEYCLOAK_ISSUER }),
    ).toThrow("KEYCLOAK_ISSUER");
  expect(parseKeycloakEnvironment(config)).toMatchObject({
    enabled: true,
    issuer: "https://sso.example.org/realms/pinda",
  });
});
test("identidade inclui realm e subject imutável, sem usar e-mail", () => {
  expect(keycloakAccountId("https://sso/realms/a", "123")).not.toBe(
    keycloakAccountId("https://sso/realms/b", "123"),
  );
  expect(() =>
    keycloakAccountId("https://sso/realms/a", "bad\nsubject"),
  ).toThrow();
});
describe("vinculação explícita", () => {
  const ids = { actorId: crypto.randomUUID(), userId: crypto.randomUUID() };
  test("configuração desabilitada e entradas inválidas nunca chamam o repository", async () => {
    let called = false;
    const repository = {
      apply: async () => {
        called = true;
      },
    };
    await expect(
      manageKeycloakBinding(
        repository,
        { ...ids, action: "link", subject: "subject" },
        { enabled: false },
      ),
    ).rejects.toThrow("habilite");
    await expect(
      manageKeycloakBinding(
        repository,
        { ...ids, action: "link", subject: "" },
        parseKeycloakEnvironment(config),
      ),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });
  test("remoção permanece disponível mesmo com Keycloak desligado", async () => {
    let operation = "";
    await manageKeycloakBinding(
      {
        apply: async (input) => {
          operation = input.action;
        },
      },
      { ...ids, action: "unlink" },
      { enabled: false },
    );
    expect(operation).toBe("unlink");
  });
});

test("início de SSO não aceita redirecionamentos externos, tokens do cliente ou cadastro", () => {
  const valid = {
    provider: "keycloak",
    callbackURL: "/",
    errorCallbackURL: "/login?sso=error",
  };
  expect(keycloakSignInSchema.safeParse(valid).success).toBe(true);
  for (const changed of [
    { callbackURL: "https://evil.example" },
    { provider: "google" },
    { idToken: { token: "forged" } },
    { requestSignUp: true },
  ])
    expect(
      keycloakSignInSchema.safeParse({ ...valid, ...changed }).success,
    ).toBe(false);
});
