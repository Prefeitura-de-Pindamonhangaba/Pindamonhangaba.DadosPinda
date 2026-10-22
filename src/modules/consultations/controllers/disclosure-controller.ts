import "server-only";
import {
  authorizeRequest,
  privateJson,
  readJson,
  RequestError,
  safeRequestError,
} from "@/shared/lib/security/request";
import { discloseConsultationResults } from "@/shared/lib/consultations/server";
import { disclosureSchema } from "../schemas/disclosure-schema";
import { exportResultsCsv } from "../services/result-format";
import { ConsultationError } from "../models/consultation-types";

export async function postDisclosure(request: Request) {
  try {
    const principal = await authorizeRequest(request, "consultations:export");
    const parsed = disclosureSchema.safeParse(
      await readJson(request, 4_000_000),
    );
    if (!parsed.success)
      throw new RequestError(400, "Resultados inválidos para exportação.");
    await discloseConsultationResults(
      principal,
      parsed.data.results,
      parsed.data.format,
    );
    if (parsed.data.format === "print") return privateJson({ success: true });
    return new Response(exportResultsCsv(parsed.data.results), {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": "attachment; filename=infoconv.csv",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ConsultationError)
      return privateJson(
        {
          message:
            "Exportação não autorizada. Atualize a consulta e tente novamente.",
        },
        403,
      );
    return safeRequestError(error);
  }
}
