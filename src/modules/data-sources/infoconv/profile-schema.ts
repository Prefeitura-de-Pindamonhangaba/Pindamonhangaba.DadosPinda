import { z } from "zod";
import {
  ConsultationError,
  type ProfileData,
  type DocumentKind,
} from "@/modules/consultations/models/consultation-types";

// Identidade do perfil contratado, preservada para reutilizar o cache existente.
export const INFOCONV_CACHE_NAMESPACE = "infoconv:DEC8789";

export const normalizedProfileSchema = z.record(
  z.string(),
  z.union([
    z.string().max(4096),
    z.array(z.string()).max(99),
    z.array(z.record(z.string(), z.string().max(4096))).max(500),
  ]),
);

export function normalizeInfoconvProfile(
  kind: DocumentKind,
  document: string,
  input: unknown,
): ProfileData {
  const parsed = normalizedProfileSchema.safeParse(input);
  if (!parsed.success || parsed.data[kind.toUpperCase()] !== document)
    throw new ConsultationError("invalid_response");
  return parsed.data;
}
