import { keycloakSignInSchema } from "@/modules/auth/schemas/keycloak-schema";
import "server-only";
import { getAuth } from "@/shared/lib/auth/server";
import { parseAuthEnvironment } from "@/shared/lib/env";
import { loginSchema } from "@/modules/auth/schemas/login-schema";
import { z } from "zod";
import {
  authorizeRequest,
  readJson,
  safeRequestError,
} from "@/shared/lib/security/request";

const publicEndpoints = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-out",
  "/api/auth/get-session",
  "/api/auth/change-password",
]);

export async function handleAuthRequest(request: Request) {
  const path = new URL(request.url).pathname;
  const sso =
    path === "/api/auth/sign-in/social" ||
    path === "/api/auth/callback/keycloak";
  if (sso && process.env.KEYCLOAK_ENABLED !== "true")
    return Response.json({ message: "Recurso indisponível." }, { status: 404 });
  if (sso && request.method !== (path.endsWith("/keycloak") ? "GET" : "POST"))
    return Response.json({ message: "Método não permitido." }, { status: 405 });
  if (!publicEndpoints.has(path) && !sso)
    return Response.json({ message: "Recurso indisponível." }, { status: 404 });
  try {
    if (request.method === "POST") {
      const env = parseAuthEnvironment(process.env);
      if (request.headers.get("origin") !== new URL(env.APP_URL).origin)
        return Response.json(
          { message: "Origem não autorizada." },
          { status: 403 },
        );
      if (path === "/api/auth/sign-in/social") {
        const parsed = keycloakSignInSchema.safeParse(
          await readJson(request.clone()),
        );
        if (!parsed.success)
          return Response.json(
            { message: "Solicitação de login inválida." },
            { status: 400 },
          );
      }
      if (path === "/api/auth/sign-in/email") {
        const text = await request.clone().text();
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          return Response.json(
            { message: "Informe e-mail e senha válidos." },
            { status: 400 },
          );
        }
        if (text.length > 4096 || !loginSchema.safeParse(payload).success)
          return Response.json(
            { message: "Informe e-mail e senha válidos." },
            { status: 400 },
          );
      }
    }
    if (request.method === "POST" && path === "/api/auth/change-password") {
      await authorizeRequest(request, "panel:read");
      const parsed = z
        .object({
          currentPassword: z.string().min(1).max(128),
          newPassword: z.string().min(12).max(128),
          revokeOtherSessions: z.literal(true),
        })
        .safeParse(await readJson(request.clone()));
      if (!parsed.success)
        return Response.json(
          {
            message:
              "Verifique a senha atual e a nova senha de 12 a 128 caracteres.",
          },
          { status: 400 },
        );
    }
    const response = await getAuth().handler(request);
    if (
      request.method === "POST" &&
      path === "/api/auth/sign-out" &&
      response.ok
    ) {
      // O SDK trata falhas de revogação internamente; confirme antes de anunciar saída.
      if (await getAuth().api.getSession({ headers: request.headers }))
        throw new Error("Sessão não revogada.");
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (path === "/api/auth/change-password") return safeRequestError(error);
    console.error(JSON.stringify({ event: "auth.request_unavailable" }));
    return Response.json(
      { message: "Não foi possível acessar o serviço de autenticação." },
      { status: 503 },
    );
  }
}
