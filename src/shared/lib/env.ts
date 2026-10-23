import { z } from "zod";

export const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    ALLOW_LOCAL_HTTP: z.enum(["true", "false"]).default("false"),
    APP_URL: z.url({ protocol: /^https?$/ }),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      !value.APP_URL.startsWith("https://") &&
      !(value.ALLOW_LOCAL_HTTP === "true" && isLoopbackUrl(value.APP_URL))
    ) {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "Produção exige HTTPS.",
      });
    }
  });

export function parseEnvironment(input: Record<string, string | undefined>) {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Configuração de ambiente inválida: ${fields.join(", ")}.`);
  }
  return result.data;
}

export function parseAuthEnvironment(
  input: Record<string, string | undefined>,
) {
  const base = parseEnvironment(input);
  const secret = z.string().min(32).safeParse(input.BETTER_AUTH_SECRET);
  if (!secret.success)
    throw new Error("Configuração de ambiente inválida: BETTER_AUTH_SECRET.");
  return { ...base, BETTER_AUTH_SECRET: secret.data };
}

export function isLoopbackUrl(value: string) {
  const url = new URL(value);
  return (
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  );
}
