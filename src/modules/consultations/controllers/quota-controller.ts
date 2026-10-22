import "server-only";
import {
  authorizeRequest,
  privateJson,
  readJson,
  RequestError,
  safeRequestError,
} from "@/shared/lib/security/request";
import {
  getMonthlyQuota,
  setMonthlyQuota,
} from "@/shared/lib/consultations/server";
import { quotaApprovalSchema } from "../services/quota-policy";
export async function getQuota(request: Request) {
  try {
    const principal = await authorizeRequest(
      request,
      "consultations:quota:manage",
    );
    return privateJson(await getMonthlyQuota(principal));
  } catch (error) {
    return safeRequestError(error);
  }
}
export async function postQuota(request: Request) {
  try {
    const principal = await authorizeRequest(
      request,
      "consultations:quota:manage",
    );
    const input = quotaApprovalSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new RequestError(
        400,
        "Informe quantidade, justificativa e ciência da cobrança adicional.",
      );
    await setMonthlyQuota(principal, input.data);
    return privateJson(await getMonthlyQuota(principal));
  } catch (error) {
    if (error instanceof Error && error.message === "quota_month_changed")
      return privateJson(
        { message: "O mês mudou. Atualize a página antes de liberar." },
        409,
      );
    return safeRequestError(error);
  }
}
