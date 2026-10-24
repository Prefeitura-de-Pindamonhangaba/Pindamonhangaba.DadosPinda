import {
  CPF_FIELDS,
  CNPJ_FIELDS,
} from "@/modules/data-sources/infoconv/fields";
import { describeInfoconvCode } from "@/modules/data-sources/infoconv/domain-labels";
import type {
  ConsultationResult,
  ProfileData,
} from "../models/consultation-types";

export const originLabels = {
  cache: "Base local criptografada",
  serpro: "SERPRO · Infoconv",
  mock: "Dados fictícios de teste",
} as const;
export const statusLabels = {
  success: "Concluída",
  not_found: "Sem resultado",
  unavailable: "Indisponível",
} as const;

const DATE_FIELDS = new Set([
  "DataNascimento",
  "DataAtualizacao",
  "DataInscricao",
  "DataSituacaoCadastral",
  "DataAbertura",
  "DataSituacaoEspecial",
]);
const ZERO_IS_VALID = new Set([
  "SituacaoCadastral",
  "MotivoSituacao",
  "CapitalSocial",
  "PercentualParticipacao",
]);

export function formatDate(value: string) {
  const text = value.trim();
  let year: string, month: string, day: string;
  const iso =
    /^(\d{4})-?(\d{2})-?(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(
      text,
    );
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (iso) [, year, month, day] = iso;
  else if (brazilian) [, day, month, year] = brazilian;
  else return "-";
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    Number(year) < 1000 ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  )
    return "-";
  return `${day}/${month}/${year}`;
}

export function formatField(
  value: ProfileData[string] | undefined,
  field = "",
): string {
  if (
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
    return "-";
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || /^(null|undefined)$/i.test(text)) return "-";
    const description = describeInfoconvCode(field, text);
    if (description) return description;
    if (DATE_FIELDS.has(field)) return formatDate(text);
    if (field === "AnoObito") {
      if (/^0+$/.test(text)) return "Não se aplica";
      return /^(1\d{3}|2\d{3})$/.test(text) ? text : "-";
    }
    // Código cadastral 0 e valores monetários/percentuais zero são legítimos.
    if (
      /^[0\s.,/()+-]+$/.test(text) &&
      /0/.test(text) &&
      ZERO_IS_VALID.has(field)
    )
      return field === "CapitalSocial" ? "0,00" : "0";
    if (
      /^[0\s./()+-]+$/.test(text) &&
      !ZERO_IS_VALID.has(field) &&
      (text.replace(/\D/g, "").length > 1 ||
        /^(CPF|CNPJ|CPFResponsavel|CEP|DDD\d?|Telefone\d?)$/.test(field))
    )
      return "-";
    if (
      (field === "CPF" || field === "CPFResponsavel" || field === "Numero") &&
      /^\d{11}$/.test(text)
    )
      return text.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    if (
      (field === "CNPJ" || field === "Numero") &&
      /^[A-Z\d]{12}\d{2}$/i.test(text)
    )
      return text.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
    if (field === "CEP" && /^\d{8}$/.test(text))
      return text.replace(/^(\d{5})(\d{3})$/, "$1-$2");
    if (/^Telefone\d?$/.test(field) && /^\d{8,9}$/.test(text))
      return text.replace(/^(\d{4,5})(\d{4})$/, "$1-$2");
    return text;
  }
  return value
    .map((item) =>
      typeof item === "string"
        ? formatField(item, field)
        : Object.entries(item)
            .map(([key, entry]) => `${key}: ${formatField(entry, key)}`)
            .join(" · "),
    )
    .join("; ");
}

export function exportResultsCsv(results: ConsultationResult[]) {
  const fields = Object.entries({ ...CPF_FIELDS, ...CNPJ_FIELDS });
  // Prefixo de texto impede fórmulas e preserva zeros à esquerda no Excel.
  const cell = (value: string) => `"'${value.replaceAll('"', '""')}"`;
  const header = [
    "Correlação",
    "Lote",
    "Documento",
    "Tipo",
    "Situação",
    "Origem",
    "Obtido em",
    "Validade do cache",
    ...fields.map(([, label]) => label),
    "Mensagem",
  ];
  return (
    "\ufeff" +
    [
      header,
      ...results.map((result) => [
        result.id,
        result.batchId,
        result.document,
        result.kind.toUpperCase(),
        statusLabels[result.status],
        originLabels[result.origin],
        result.obtainedAt,
        result.expiresAt ?? "",
        ...fields.map(([key]) => formatField(result.data[key], key)),
        result.message ?? "",
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
