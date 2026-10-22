import { z } from "zod";

const officialWsdl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    url.hostname === "acesso.infoconv.receita.fazenda.gov.br" &&
    !url.port &&
    !url.username &&
    !url.password &&
    /^\/ws\/(cpf\/consultarcpf|cnpj\/consultarcnpj)\.asmx$/i.test(url.pathname)
  );
});

const schema = z.object({
  INFOCONV_MONTHLY_LIMIT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().optional(),
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
  INFOCONV_CERTIFICATE_PATH: z.string().min(1),
  INFOCONV_CERTIFICATE_PASSPHRASE: z.string().default(""),
  INFOCONV_REQUESTER_CPF: z.string().regex(/^\d{11}$/),
  INFOCONV_CA_PATH: z.string().optional(),
  INFOCONV_CPF_WSDL: officialWsdl,
  INFOCONV_CNPJ_WSDL: officialWsdl,
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
