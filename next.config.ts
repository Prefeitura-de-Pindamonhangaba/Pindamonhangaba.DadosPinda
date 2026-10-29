import type { NextConfig } from "next";

const buildCpus = process.env.NEXT_BUILD_CPUS
  ? Number(process.env.NEXT_BUILD_CPUS)
  : undefined;
if (
  buildCpus !== undefined &&
  (!Number.isInteger(buildCpus) || buildCpus < 1 || buildCpus > 32)
)
  throw new Error("NEXT_BUILD_CPUS deve ser um inteiro entre 1 e 32.");

const nextConfig: NextConfig = {
  agentRules: false,
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined,
  distDir: process.env.PLAYWRIGHT_TEST === "1" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  experimental: { cpus: buildCpus },
  // O callback OIDC contém código temporário e state na query string.
  logging: {
    incomingRequests: { ignore: [/\/api\/auth\/callback\/keycloak/] },
  },
  serverExternalPackages: ["soap"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
