import { z } from "zod";
import type { DocumentKind } from "../models/consultation-types";

export function normalizeDocument(value: string) {
  return value.toUpperCase().replace(/[.\-/\s]/g, "");
}

export function isValidDocument(kind: DocumentKind, input: string): boolean {
  const value = normalizeDocument(input);
  if (kind === "cpf") {
    if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
    for (let length = 9; length <= 10; length++) {
      const sum = [...value.slice(0, length)].reduce(
        (total, digit, index) => total + Number(digit) * (length + 1 - index),
        0,
      );
      const digit = ((sum * 10) % 11) % 10;
      if (digit !== Number(value[length])) return false;
    }
    return true;
  }
  if (!/^[A-Z\d]{12}\d{2}$/.test(value) || /^(\d)\1+$/.test(value))
    return false;
  for (let length = 12; length <= 13; length++) {
    let weight = length === 12 ? 5 : 6;
    let sum = 0;
    for (const character of value.slice(0, length)) {
      sum += (character.charCodeAt(0) - 48) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const remainder = sum % 11;
    if ((remainder < 2 ? 0 : 11 - remainder) !== Number(value[length]))
      return false;
  }
  return true;
}

export const consultationSchema = z
  .object({
    kind: z.enum(["cpf", "cnpj"]),
    document: z.string().max(24).transform(normalizeDocument),
    purpose: z.string().trim().min(10).max(500),
    batchId: z.uuid(),
    forceRefresh: z.boolean().default(false),
    batch: z.boolean().default(false),
  })
  .refine((value) => isValidDocument(value.kind, value.document), {
    path: ["document"],
    message: "Documento inválido.",
  })
  .refine(
    (value) => !normalizeDocument(value.purpose).includes(value.document),
    {
      path: ["purpose"],
      message: "Não inclua o documento pesquisado na finalidade.",
    },
  );

export type ConsultationInput = z.infer<typeof consultationSchema>;

export function parseDocumentList(kind: DocumentKind, text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows.length === 0 || rows.length > 500)
    throw new Error("Informe de 1 a 500 documentos, um por linha.");
  const documents = rows.map(normalizeDocument);
  const invalid = documents.findIndex((value) => !isValidDocument(kind, value));
  if (invalid !== -1)
    throw new Error(`Documento inválido na linha ${invalid + 1}.`);
  return [...new Set(documents)];
}
