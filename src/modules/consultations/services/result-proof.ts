import { createHmac, timingSafeEqual } from "node:crypto";
import type { ConsultationResult } from "../models/consultation-types";

function payload(result: ConsultationResult) {
  return JSON.stringify([
    result.id,
    result.batchId,
    result.kind,
    result.document,
    result.status,
    result.origin,
    result.obtainedAt,
    result.expiresAt ?? null,
    result.data,
    result.message ?? null,
  ]);
}
export function signResult(key: string, result: ConsultationResult) {
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update("infoconv:result:" + payload(result))
    .digest("hex");
}
export function verifyResult(key: string, result: ConsultationResult) {
  if (!result.proof || !/^[a-f\d]{64}$/.test(result.proof)) return false;
  return timingSafeEqual(
    Buffer.from(signResult(key, result), "hex"),
    Buffer.from(result.proof, "hex"),
  );
}
