import {
  canAccess,
  type Principal,
} from "@/modules/auth/services/access-service";
import type { ConsultationRepository } from "../models/consultation-repository";
import { ConsultationError } from "../models/consultation-types";
export async function listConsultationAudit(
  repository: ConsultationRepository,
  principal: Principal,
) {
  if (!canAccess(principal, "audit:read"))
    throw new ConsultationError("forbidden");
  return {
    records: await repository.listAudit(),
    usage: await repository.usage(),
  };
}
