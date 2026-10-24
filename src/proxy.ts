import { NextResponse, type NextRequest } from "next/server";
import { getPrincipal } from "@/modules/auth/controllers/access-controller";
import { canAccess } from "@/modules/auth/services/access-service";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    path === "/login" ||
    path === "/icon.svg" ||
    path === "/brand/prefeitura-pindamonhangaba.svg" ||
    path === "/api/health" ||
    path.startsWith("/api/auth/")
  )
    return NextResponse.next();
  try {
    const principal = await getPrincipal(request.headers);
    if (canAccess(principal, "panel:read")) {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    if (path.startsWith("/api/"))
      return NextResponse.json(
        { message: "Acesso não autorizado." },
        { status: principal ? 403 : 401 },
      );
    return NextResponse.redirect(new URL("/login", request.url));
  } catch {
    console.error(JSON.stringify({ event: "auth.access_unavailable" }));
    if (path.startsWith("/api/"))
      return NextResponse.json(
        { message: "Serviço de autenticação indisponível." },
        { status: 503 },
      );
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
