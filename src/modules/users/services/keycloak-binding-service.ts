import { z } from "zod";
import type { createKeycloakBindingRepository } from "../models/keycloak-binding-repository";
import {
  keycloakAccountId,
  parseKeycloakEnvironment,
} from "@/modules/auth/services/keycloak-config";

const common = z.object({ actorId: z.uuid(), userId: z.uuid() });
const inputSchema = z.discriminatedUnion("action", [
  common.extend({
    action: z.literal("link"),
    subject: z.string().min(1).max(255),
  }),
  common.extend({ action: z.literal("unlink") }),
]);

export async function manageKeycloakBinding(
  repository: ReturnType<typeof createKeycloakBindingRepository>,
  input: unknown,
  environment: ReturnType<typeof parseKeycloakEnvironment>,
) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      "Informe action, actorId e userId válidos; link também exige subject.",
    );
  if (parsed.data.action === "unlink") return repository.apply(parsed.data);
  if (!environment.enabled)
    throw new Error(
      "Configure e habilite o Keycloak antes de vincular usuários.",
    );
  return repository.apply({
    ...parsed.data,
    accountId: keycloakAccountId(environment.issuer, parsed.data.subject),
  });
}
