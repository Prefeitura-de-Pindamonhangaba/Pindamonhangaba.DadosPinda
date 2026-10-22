import "server-only";
import { canAccess } from "@/modules/auth/services/access-service";
import {
  authorizeRequest,
  privateJson,
  readJson,
  RequestError,
  safeRequestError,
} from "@/shared/lib/security/request";
import { consultationSchema } from "../schemas/consultation-schema";
import {
  runConsultation,
  readConsultationAudit,
} from "@/shared/lib/consultations/server";
import { ConsultationError } from "../models/consultation-types";

export async function postConsultation(request: Request) {
  try {
    const principal = await authorizeRequest(request, "consultations:read");
    const parsed = consultationSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new RequestError(
        400,
        "Informe documento válido e finalidade com pelo menos 10 caracteres.",
      );
    const input = parsed.data;
    if (input.batch && !canAccess(principal, "consultations:batch"))
      throw new RequestError(403, "Consulta em lote não autorizada.");
    if (
      !canAccess(principal, `consultations:${input.kind}`) ||
      !canAccess(principal, "sources:infoconv") ||
      (input.forceRefresh && !canAccess(principal, "consultations:refresh"))
    )
      throw new RequestError(403, "Acesso não autorizado.");
    const result = await runConsultation(principal, input);
    return privateJson(result);
  } catch (error) {
    if (error instanceof ConsultationError)
      return privateJson(
        {
          code: error.code,
          message:
            error.code === "forbidden"
              ? "Acesso não autorizado."
              : error.code === "monthly_limit"
                ? "Teto mensal autorizado atingido. Novas chamadas exigem liberação administrativa em Auditoria de consultas, pois há cobrança adicional. Dados válidos na base local continuam disponíveis."
                : "Limite de consultas atingido. Aguarde antes de continuar.",
        },
        error.code === "forbidden" ? 403 : 429,
        error.code === "rate_limit" ? { "Retry-After": "60" } : undefined,
      );
    return safeRequestError(error);
  }
}

export async function getConsultationAudit(request: Request) {
  try {
    const principal = await authorizeRequest(request, "consultations:read");
    return privateJson(await readConsultationAudit(principal));
  } catch (error) {
    return safeRequestError(error);
  }
}
