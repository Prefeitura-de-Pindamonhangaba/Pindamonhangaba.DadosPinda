import "server-only";
import { getDatabase } from "@/shared/lib/db/client";
import { createConsultationRepository } from "@/modules/consultations/models/consultation-repository";

export function startCacheRetention() {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    !process.env.INFOCONV_CACHE_KEY ||
    (process.env.NODE_ENV !== "production" &&
      process.env.PLAYWRIGHT_TEST === "1")
  )
    return;
  const purge = () => {
    void createConsultationRepository(getDatabase())
      .purgeExpired()
      .catch(() =>
        console.error(JSON.stringify({ event: "cache.purge_failed" })),
      );
  };
  purge();
  setInterval(purge, 60_000).unref();
}
