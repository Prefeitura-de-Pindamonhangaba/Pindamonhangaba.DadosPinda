import "server-only";
import { getAuth } from "@/shared/lib/auth/server";
import { parseAuthEnvironment } from "@/shared/lib/env";
import { loginSchema } from "@/modules/auth/schemas/login-schema";

const publicEndpoints = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-out",
  "/api/auth/get-session",
]);

export async function handleAuthRequest(request: Request) {
  const path = new URL(request.url).pathname;
  if (!publicEndpoints.has(path))
    return Response.json({ message: "Recurso indisponível." }, { status: 404 });
  try {
    if (request.method === "POST") {
      const env = parseAuthEnvironment(process.env);
      if (request.headers.get("origin") !== new URL(env.APP_URL).origin)
        return Response.json(
          { message: "Origem não autorizada." },
          { status: 403 },
        );
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
  } catch {
    console.error(JSON.stringify({ event: "auth.request_unavailable" }));
    return Response.json(
      { message: "Não foi possível acessar o serviço de autenticação." },
      { status: 503 },
    );
  }
}
