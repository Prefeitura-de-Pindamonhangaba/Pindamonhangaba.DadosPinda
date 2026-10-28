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
  INFOCONV_CERTIFICATE_FORMAT: z.enum(["auto", "pem", "pfx"]).default("auto"),
  INFOCONV_CERTIFICATE_PATH: z.string().min(1),
  INFOCONV_CERTIFICATE_PASSPHRASE: z.string().default(""),
  INFOCONV_REQUESTER_CPF: z.string().regex(/^\d{11}$/),
  INFOCONV_CA_PATH: z.string().optional(),
  INFOCONV_CPF_WSDL: officialWsdl,
  INFOCONV_CNPJ_WSDL: officialWsdl,
});

export function parseSoapEnvironment(
  input: Record<string, string | undefined>,
) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Configuração Infoconv SOAP inválida: ${[...new Set(result.error.issues.map((issue) => issue.path[0]))].join(", ")}.`,
    );
  return result.data;
}
export type SoapEnvironment = ReturnType<typeof parseSoapEnvironment>;
