import { z } from "zod";
import { createHash } from "node:crypto";
import { keycloakAccountId } from "./keycloak-config";
import type { KeycloakIdentity } from "../models/keycloak-identity";

export function parseKeycloakIdentity(
  profile: unknown,
  issuer: string,
  clientId: string,
): KeycloakIdentity | null {
  const parsed = z
    .object({
      iss: z.literal(issuer),
      sub: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[^\x00-\x20\x7f]+$/),
      name: z.string().max(255).optional(),
      preferred_username: z.string().max(255).optional(),
      resource_access: z.record(z.string(), z.unknown()).optional(),
    })
    .safeParse(profile);
  if (!parsed.success) return null;
  const client = z
    .object({ roles: z.array(z.string().max(255)).max(1000) })
    .safeParse(parsed.data.resource_access?.[clientId]);
  if (!client.success) return null;
  const role = (["admin", "operator", "viewer"] as const).find((value) =>
    client.data.roles.includes(value),
  );
  if (!role) return null;
  const accountId = keycloakAccountId(issuer, parsed.data.sub);
  return {
    accountId,
    subject: parsed.data.sub,
    role,
    name:
      parsed.data.name?.trim() ||
      parsed.data.preferred_username?.trim() ||
      "Servidor municipal",
    // Identificador técnico exigido pelo SDK; não é usado como identidade nem para envio de e-mail.
    technicalEmail: `${createHash("sha256").update(accountId).digest("hex")}@identity.invalid`,
  };
}
