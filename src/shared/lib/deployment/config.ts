import { z } from "zod";
import { parseAuthEnvironment } from "../env";

type Variables = Record<string, string | undefined>;

// O mesmo seletor ativa o banco no Compose e define a política de inicialização.
export function resolveDeployment(input: Variables) {
  const mode = z
    .enum(["development", "production"])
    .safeParse(input.COMPOSE_PROFILES);
  if (!mode.success)
    throw new Error(
      "Defina COMPOSE_PROFILES=development ou production no .env (um único ambiente).",
    );
  const production = mode.data === "production";
  const missing: string[] = [];
  if (!production) {
    for (const key of ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"])
      if (!input[key]?.trim()) missing.push(key);
  } else if (!input.DATABASE_URL?.trim()) missing.push("DATABASE_URL");
  if (!input.APP_URL?.trim()) missing.push("APP_URL");
  if (!input.BETTER_AUTH_SECRET || input.BETTER_AUTH_SECRET.length < 32)
    missing.push("BETTER_AUTH_SECRET (mínimo de 32 caracteres)");
  if (missing.length)
    throw new Error(`Deploy incompleto. Configure: ${missing.join(", ")}.`);

  const databaseUrl = production
    ? input.DATABASE_URL!
    : `postgresql://${encodeURIComponent(input.POSTGRES_USER!)}:${encodeURIComponent(input.POSTGRES_PASSWORD!)}@db:5432/${encodeURIComponent(input.POSTGRES_DB!)}`;
  if (production) {
    const parsed = z
      .url({ protocol: /^postgres(ql)?$/ })
      .safeParse(databaseUrl);
    if (!parsed.success)
      throw new Error(
        "DATABASE_URL: informe uma connection string PostgreSQL válida.",
      );
    const hostname = new URL(databaseUrl).hostname;
    if (["db", "localhost", "127.0.0.1", "[::1]"].includes(hostname))
      throw new Error(
        "DATABASE_URL: produção exige banco em servidor externo; localhost identifica o próprio container.",
      );
    if (!input.APP_URL!.startsWith("https://"))
      throw new Error(
        "APP_URL: produção exige uma URL HTTPS e proxy com TLS configurado.",
      );
  }
  const environment = {
    ...input,
    NODE_ENV: "production",
    ALLOW_LOCAL_HTTP: production ? "false" : "true",
    DATABASE_URL: databaseUrl,
  };
  parseAuthEnvironment(environment);
  return { mode: mode.data, production, environment, databaseUrl };
}
