export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCacheRetention } =
      await import("@/shared/lib/maintenance/cache-retention");
    startCacheRetention();
  }
}
