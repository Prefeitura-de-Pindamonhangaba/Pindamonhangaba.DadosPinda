import { z } from "zod";
import { cachedProfileSchema } from "@/modules/data-sources/infoconv/response-schema";
export const disclosureSchema = z.object({
  format: z.enum(["csv", "print"]),
  results: z
    .array(
      z.object({
        id: z.uuid(),
        batchId: z.uuid(),
        kind: z.enum(["cpf", "cnpj"]),
        document: z.string().max(24),
        status: z.enum(["success", "not_found", "unavailable"]),
        origin: z.enum(["cache", "serpro", "mock"]),
        obtainedAt: z.iso.datetime(),
        expiresAt: z.iso.datetime().optional(),
        data: cachedProfileSchema,
        message: z.string().max(500).optional(),
        proof: z.string().regex(/^[a-f\d]{64}$/),
      }),
    )
    .min(1)
    .max(500),
});
