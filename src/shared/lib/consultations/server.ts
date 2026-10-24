import "server-only";
import { getDatabase } from "@/shared/lib/db/client";
import { type Principal } from "@/modules/auth/services/access-service";
import { parseInfoconvEnvironment } from "@/modules/data-sources/infoconv/env";
import { createInfoconvAdapter } from "@/modules/data-sources/infoconv/adapter-factory";
import {
  createConsultationRepository,
  withDocumentLock,
} from "@/modules/consultations/models/consultation-repository";
import { listConsultationAudit } from "@/modules/consultations/services/audit-service";
import { consultDocument } from "@/modules/consultations/services/consultation-service";
import { documentDigest } from "@/modules/consultations/services/cache-crypto";
import type { ConsultationInput } from "@/modules/consultations/schemas/consultation-schema";
import type { ConsultationResult } from "@/modules/consultations/models/consultation-types";
import { signResult } from "@/modules/consultations/services/result-proof";
import { authorizeDisclosure } from "@/modules/consultations/services/disclosure-service";
import { createAuditRepository } from "@/modules/audit/models/audit-repository";
import { createQuotaRepository } from "@/modules/consultations/models/quota-repository";
import {
  approveQuota,
  readQuota,
} from "@/modules/consultations/services/quota-service";

export async function getMonthlyQuota(principal: Principal) {
  return readQuota(
    createQuotaRepository(getDatabase()),
    principal,
    parseInfoconvEnvironment(process.env).INFOCONV_MONTHLY_LIMIT,
  );
}
export async function setMonthlyQuota(principal: Principal, input: unknown) {
  await approveQuota(createQuotaRepository(getDatabase()), principal, input);
}

export async function runConsultation(
  principal: Principal,
  input: ConsultationInput,
) {
  const env = parseInfoconvEnvironment(process.env);
  const adapter = await createInfoconvAdapter(env);
  const key = documentDigest(
    env.INFOCONV_AUDIT_KEY,
    input.kind,
    input.document,
  );
  const result = await withDocumentLock(getDatabase(), key, (repository) =>
    consultDocument(repository, adapter, env, principal, input),
  );
  return { ...result, proof: signResult(env.INFOCONV_AUDIT_KEY, result) };
}

export async function readConsultationAudit(principal: Principal) {
  return listConsultationAudit(
    createConsultationRepository(getDatabase()),
    principal,
  );
}

export async function discloseConsultationResults(
  principal: Principal,
  results: ConsultationResult[],
  format: "csv" | "print",
) {
  const key = parseInfoconvEnvironment(process.env).INFOCONV_AUDIT_KEY;
  await authorizeDisclosure(
    createConsultationRepository(getDatabase()),
    key,
    principal,
    results,
  );
  await createAuditRepository(getDatabase()).record(
    principal.id,
    format === "csv" ? "consultations.exported" : "consultations.printed",
  );
}
