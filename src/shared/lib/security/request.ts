import "server-only";
import { getPrincipal } from "@/modules/auth/controllers/access-controller";
import { canAccess } from "@/modules/auth/services/access-service";
import type { Permission } from "@/modules/auth/permissions";
import { parseEnvironment } from "@/shared/lib/env";

export class RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function authorizeRequest(
  request: Request,
  permission: Permission,
) {
  const principal = await getPrincipal(request.headers);
  if (!principal) throw new RequestError(401, "Autenticação necessária.");
  if (!canAccess(principal, permission))
    throw new RequestError(403, "Acesso não autorizado.");
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !==
      new URL(parseEnvironment(process.env).APP_URL).origin
  )
    throw new RequestError(403, "Origem não autorizada.");
  return principal;
}

export async function readJson(
  request: Request,
  maxBytes = 8192,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, "Dados inválidos.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.length;
    if (length > maxBytes) {
      await reader.cancel();
      throw new RequestError(413, "Dados excedem o tamanho permitido.");
    }
    chunks.push(chunk.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "Dados inválidos.");
  }
}

export function privateJson(
  value: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", ...extraHeaders },
  });
}

export function safeRequestError(error: unknown) {
  if (error instanceof RequestError)
    return privateJson({ message: error.message }, error.status);
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 3 && current && typeof current === "object";
    depth++
  ) {
    const failure = current as { code?: unknown; cause?: unknown };
    if (failure.code === "23505")
      return privateJson(
        { message: "Já existe um cadastro com esses dados." },
        409,
      );
    if (failure.code === "23503")
      return privateJson(
        {
          message:
            "O registro possui vínculos ou a referência informada não existe.",
        },
        409,
      );
    current = failure.cause;
  }
  console.error(JSON.stringify({ event: "request.internal_error" }));
  return privateJson(
    { message: "Serviço indisponível. Tente novamente em instantes." },
    503,
  );
}
