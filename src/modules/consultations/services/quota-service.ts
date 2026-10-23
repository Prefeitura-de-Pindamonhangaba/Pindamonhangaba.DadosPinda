import {
  canAccess,
  type Principal,
} from "@/modules/auth/services/access-service";
import type { createQuotaRepository } from "../models/quota-repository";
import { ConsultationError } from "../models/consultation-types";
import { currentQuotaMonth, quotaApprovalSchema } from "./quota-policy";

type Repository = ReturnType<typeof createQuotaRepository>;
function authorize(principal: Principal) {
  if (!canAccess(principal, "consultations:quota:manage"))
    throw new ConsultationError("forbidden");
}
export async function readQuota(
  repository: Repository,
  principal: Principal,
  included: number,
) {
  authorize(principal);
  const month = currentQuotaMonth();
  return { month, included, ...(await repository.read(month)) };
}
export async function approveQuota(
  repository: Repository,
  principal: Principal,
  input: unknown,
) {
  authorize(principal);
  const parsed = quotaApprovalSchema.parse(input);
  if (parsed.month !== currentQuotaMonth())
    throw new Error("quota_month_changed");
  await repository.approve({
    month: parsed.month,
    additional: parsed.additional,
    reason: parsed.reason,
    actorId: principal.id,
  });
}
