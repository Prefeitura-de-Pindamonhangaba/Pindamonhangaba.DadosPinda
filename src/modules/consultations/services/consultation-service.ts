import {
  canAccess,
  type Principal,
} from "@/modules/auth/services/access-service";
import type { InfoconvEnvironment } from "@/modules/data-sources/infoconv/env";
import { cachedProfileSchema } from "@/modules/data-sources/infoconv/response-schema";
import type { ConsultationRepository } from "../models/consultation-repository";
import type { ConsultationInput } from "../schemas/consultation-schema";
import {
  ConsultationError,
  type ConsultationResult,
  type DataSourceAdapter,
} from "../models/consultation-types";
import {
  cacheContext,
  decryptCache,
  documentDigest,
  encryptCache,
} from "./cache-crypto";

export const CACHE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function consultDocument(
  repository: ConsultationRepository,
  adapter: DataSourceAdapter,
  env: InfoconvEnvironment,
  principal: Principal,
  input: ConsultationInput,
): Promise<ConsultationResult> {
  if (
    ![
      "consultations:read",
      `consultations:${input.kind}`,
      "sources:infoconv",
    ].every((permission) =>
      canAccess(
        principal,
        permission as
          | "consultations:read"
          | "consultations:cpf"
          | "consultations:cnpj"
          | "sources:infoconv",
      ),
    ) ||
    (input.forceRefresh && !canAccess(principal, "consultations:refresh"))
  )
    throw new ConsultationError("forbidden");
  const digest = documentDigest(
    env.INFOCONV_AUDIT_KEY,
    input.kind,
    input.document,
  );
  const key = `${input.kind}:${digest}`;
  await repository.purgeExpired();
  const cached = input.forceRefresh
    ? undefined
    : await repository.findCache(key);
  const origin = cached ? "cache" : adapter.isMock ? "mock" : "serpro";
  const id = await repository.reserve(
    {
      userId: principal.id,
      batchId: input.batchId,
      kind: input.kind,
      documentDigest: digest,
      documentMasked: `${"*".repeat(input.document.length - 4)}${input.document.slice(-4)}`,
      purpose: input.purpose,
      origin,
    },
    env.INFOCONV_REQUESTS_PER_MINUTE,
    env.INFOCONV_MONTHLY_LIMIT,
    input.kind === "cpf"
      ? env.INFOCONV_MONTHLY_LIMIT_CPF
      : env.INFOCONV_MONTHLY_LIMIT_CNPJ,
  );
  const base = {
    id,
    batchId: input.batchId,
    kind: input.kind,
    document: input.document,
  };
  try {
    if (cached) {
      const data = cachedProfileSchema.parse(
        decryptCache(
          env.INFOCONV_CACHE_KEY,
          cacheContext(key, cached.obtainedAt, cached.expiresAt),
          cached.ciphertext,
        ),
      );
      if (data[input.kind.toUpperCase()] !== input.document)
        throw new ConsultationError("invalid_response");
      await repository.complete(id, "success");
      return {
        ...base,
        status: "success",
        origin: "cache",
        obtainedAt: cached.obtainedAt.toISOString(),
        expiresAt: cached.expiresAt.toISOString(),
        data,
      };
    }
    const result = await adapter.consult(input.kind, input.document);
    const obtainedAt = new Date();
    const expiresAt = new Date(obtainedAt.getTime() + CACHE_RETENTION_MS);
    const data = cachedProfileSchema.parse(result.data);
    if (data[input.kind.toUpperCase()] !== input.document)
      throw new ConsultationError("invalid_response");
    if (!result.mock)
      await repository.saveCache({
        key,
        kind: input.kind,
        ciphertext: encryptCache(
          env.INFOCONV_CACHE_KEY,
          cacheContext(key, obtainedAt, expiresAt),
          data,
        ),
        obtainedAt,
        expiresAt,
      });
    await repository.complete(id, result.mock ? "mock" : "success");
    return {
      ...base,
      status: "success",
      origin: result.mock ? "mock" : "serpro",
      obtainedAt: obtainedAt.toISOString(),
      expiresAt: result.mock ? undefined : expiresAt.toISOString(),
      data,
    };
  } catch (error) {
    const status =
      error instanceof ConsultationError && error.code === "not_found"
        ? "not_found"
        : "unavailable";
    await repository.complete(id, status);
    return {
      ...base,
      status,
      origin,
      obtainedAt: new Date().toISOString(),
      data: {},
      message:
        status === "not_found"
          ? "Nenhum cadastro foi retornado pela fonte."
          : "Não foi possível obter os dados. Tente novamente ou procure o DSI.",
    };
  }
}
