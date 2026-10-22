import type { Principal } from "@/modules/auth/services/access-service";
import { canAccess } from "@/modules/auth/services/access-service";
import type { ConsultationRepository } from "../models/consultation-repository";
import {
  ConsultationError,
  type ConsultationResult,
} from "../models/consultation-types";
import { verifyResult } from "./result-proof";
import { CACHE_RETENTION_MS } from "./consultation-service";

export async function authorizeDisclosure(
  repository: ConsultationRepository,
  key: string,
  principal: Principal,
  results: ConsultationResult[],
) {
  if (
    !canAccess(principal, "consultations:export") ||
    !(await repository.ownsRecords(
      results.map((result) => result.id),
      principal.id,
    )) ||
    results.some(
      (result) =>
        !verifyResult(key, result) ||
        Date.now() - Date.parse(result.obtainedAt) > CACHE_RETENTION_MS,
    )
  )
    throw new ConsultationError("forbidden");
}
