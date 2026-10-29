import { expect, test } from "bun:test";
import { parseKeycloakIdentity } from "../src/modules/auth/services/keycloak-identity";
const issuer = "https://sso.example.test/realms/pinda";
test("somente client roles do Pinda Dados concedem acesso", () => {
  expect(
    parseKeycloakIdentity(
      { iss: issuer, sub: "one", realm_access: { roles: ["admin"] } },
      issuer,
      "pinda",
    ),
  ).toBeNull();
  expect(
    parseKeycloakIdentity(
      {
        iss: issuer,
        sub: "one",
        resource_access: { other: { roles: ["admin"] } },
      },
      issuer,
      "pinda",
    ),
  ).toBeNull();
  expect(
    parseKeycloakIdentity(
      {
        iss: issuer,
        sub: "one",
        resource_access: { pinda: { roles: ["unknown"] } },
      },
      issuer,
      "pinda",
    ),
  ).toBeNull();
  const raw = {
    iss: issuer,
    sub: "one",
    name: "Servidor",
    resource_access: { pinda: { roles: ["viewer", "operator"] } },
  };
  expect(parseKeycloakIdentity(raw, issuer, "pinda")?.role).toBe("operator");
  expect(
    parseKeycloakIdentity(
      { ...raw, iss: "https://other.test/realms/pinda" },
      issuer,
      "pinda",
    ),
  ).toBeNull();
  expect(
    parseKeycloakIdentity({ ...raw, sub: "bad identity" }, issuer, "pinda"),
  ).toBeNull();
});
test("identidade não depende de e-mail e não mistura realms ou subjects", () => {
  const raw = {
    iss: issuer,
    sub: "one",
    resource_access: { pinda: { roles: ["admin"] } },
  };
  const first = parseKeycloakIdentity(raw, issuer, "pinda")!;
  expect(first.technicalEmail).toEndWith("@identity.invalid");
  expect(
    parseKeycloakIdentity(
      { ...raw, email: "other@test.invalid", email_verified: false },
      issuer,
      "pinda",
    )?.technicalEmail,
  ).toBe(first.technicalEmail);
  expect(
    parseKeycloakIdentity({ ...raw, sub: "two" }, issuer, "pinda")
      ?.technicalEmail,
  ).not.toBe(first.technicalEmail);
});
