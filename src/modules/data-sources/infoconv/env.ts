import { z } from "zod";

const schema = z.object({
  INFOCONV_TRANSPORT: z.literal("soap").default("soap"),
  INFOCONV_MONTHLY_LIMIT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(10000),
  ),
  INFOCONV_MONTHLY_LIMIT_CPF: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  INFOCONV_MONTHLY_LIMIT_CNPJ: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  INFOCONV_ENABLED: z.enum(["true", "false"]).default("false"),
  INFOCONV_CACHE_KEY: z.string().regex(/^[a-f\d]{64}$/i),
  INFOCONV_AUDIT_KEY: z.string().regex(/^[a-f\d]{64}$/i),
  INFOCONV_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60000)
    .default(15000),
  INFOCONV_REQUESTS_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(30),
});

export function parseInfoconvEnvironment(
  input: Record<string, string | undefined>,
) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Configuração Infoconv inválida: ${[...new Set(result.error.issues.map((issue) => issue.path[0]))].join(", ")}.`,
    );
  return result.data;
}
export type InfoconvEnvironment = ReturnType<typeof parseInfoconvEnvironment>;
