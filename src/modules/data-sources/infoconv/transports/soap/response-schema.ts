import { z } from "zod";
import { CPF_FIELDS, CNPJ_FIELDS, SOCIETY_FIELDS } from "../../fields";
import {
  ConsultationError,
  type DocumentKind,
  type ProfileData,
} from "@/modules/consultations/models/consultation-types";

const stringField = z
  .string()
  .max(4096)
  .nullish()
  .transform((value) => value ?? "");
const partnerSchema = z.object(
  Object.fromEntries(
    Object.keys(SOCIETY_FIELDS).map((key) => [key, stringField]),
  ),
);
function scalarSchema<const T extends Record<string, string>>(fields: T) {
  const shape = Object.fromEntries(
    Object.keys(fields)
      .filter((key) => !["Sociedade", "CNAESecundario"].includes(key))
      .map((key) => [key, stringField]),
  ) as Record<
    Exclude<keyof T, "Sociedade" | "CNAESecundario">,
    typeof stringField
  >;
  return z.object(shape).extend({ Erro: stringField });
}
const cpfSchema = scalarSchema(CPF_FIELDS);
const cnpjSchema = scalarSchema(CNPJ_FIELDS).extend({
  CNAESecundario: z
    .object({
      string: z.union([z.string(), z.array(z.string()).max(99)]).optional(),
    })
    .nullish(),
  Sociedade: z
    .object({
      SocioPerfilDEC8789: z
        .union([partnerSchema, z.array(partnerSchema).max(500)])
        .optional(),
    })
    .nullish(),
});

export function parseSoapResponse(
  kind: DocumentKind,
  document: string,
  response: unknown,
): ProfileData {
  const operation =
    kind === "cpf" ? "ConsultarCPFPDEC8789" : "ConsultarCNPJPDEC8789";
  const profile = kind === "cpf" ? "PessoaPerfilDEC8789" : "CNPJPerfilDEC8789";
  const envelope = z.record(z.string(), z.unknown()).safeParse(response);
  const result = z
    .record(z.string(), z.unknown())
    .safeParse(envelope.success ? envelope.data[`${operation}Result`] : null);
  const raw = result.success ? result.data[profile] : null;
  const item: unknown = Array.isArray(raw)
    ? raw.length === 1
      ? raw[0]
      : undefined
    : raw;
  if (item == null) throw new ConsultationError("invalid_response");
  const parsed = (kind === "cpf" ? cpfSchema : cnpjSchema).safeParse(item);
  if (!parsed.success) throw new ConsultationError("invalid_response");
  const values: Record<string, unknown> = parsed.data;
  if (parsed.data.Erro)
    throw new ConsultationError(
      /\bErro\s+04\b/i.test(parsed.data.Erro) ? "not_found" : "unavailable",
    );
  if (!values[kind.toUpperCase()])
    throw new ConsultationError("invalid_response");
  if (values[kind.toUpperCase()] !== document)
    throw new ConsultationError("invalid_response");
  const data: ProfileData = {};
  for (const field of Object.keys(kind === "cpf" ? CPF_FIELDS : CNPJ_FIELDS)) {
    const value: unknown = values[field];
    if (typeof value === "string") data[field] = value;
  }
  if (kind === "cnpj") {
    const pj = cnpjSchema.parse(item);
    const secondary = pj.CNAESecundario?.string;
    data.CNAESecundario = secondary
      ? Array.isArray(secondary)
        ? secondary
        : [secondary]
      : [];
    const partners = pj.Sociedade?.SocioPerfilDEC8789;
    data.Sociedade = partners
      ? Array.isArray(partners)
        ? partners
        : [partners]
      : [];
  }
  return data;
}
