import {
  CPF_FIELDS,
  CNPJ_FIELDS,
} from "@/modules/data-sources/infoconv/fields";
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

export function formatField(value: ProfileData[string] | undefined) {
  if (
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
    return "Não informado";
  return typeof value === "string"
    ? value
    : value
        .map((item) =>
          typeof item === "string"
            ? item
            : Object.entries(item)
                .map(([key, entry]) => `${key}: ${entry}`)
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
        ...fields.map(([key]) =>
          result.data[key] ? formatField(result.data[key]) : "",
        ),
        result.message ?? "",
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
