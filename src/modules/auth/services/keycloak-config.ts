import { z } from "zod";

export function parseKeycloakEnvironment(
  input: Record<string, string | undefined>,
) {
  const enabled = z
    .enum(["true", "false"])
    .default("false")
    .safeParse(input.KEYCLOAK_ENABLED);
  if (!enabled.success)
    throw new Error("Configuração inválida: KEYCLOAK_ENABLED.");
  if (enabled.data === "false") return { enabled: false as const };
  const result = z
    .object({
      KEYCLOAK_ISSUER: z.url().refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          /\/realms\/[^/]+\/?$/.test(url.pathname)
        );
      }),
      KEYCLOAK_CLIENT_ID: z.string().trim().min(1).max(255),
      KEYCLOAK_CLIENT_SECRET: z.string().min(1),
    })
    .safeParse(input);
  if (!result.success)
    throw new Error(
      `Configuração Keycloak inválida: ${[...new Set(result.error.issues.map((issue) => issue.path[0]))].join(", ")}.`,
    );
  return {
    enabled: true as const,
    issuer: result.data.KEYCLOAK_ISSUER.replace(/\/$/, ""),
    clientId: result.data.KEYCLOAK_CLIENT_ID,
    clientSecret: result.data.KEYCLOAK_CLIENT_SECRET,
  };
}

const subjectSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[^\x00-\x20\x7f]+$/);
export function keycloakAccountId(issuer: string, subject: unknown) {
  const parsed = subjectSchema.safeParse(subject);
  if (!parsed.success) throw new Error("Identificador Keycloak inválido.");
  // A mesma sub em dois realms não representa a mesma identidade.
  return JSON.stringify([issuer, parsed.data]);
}
