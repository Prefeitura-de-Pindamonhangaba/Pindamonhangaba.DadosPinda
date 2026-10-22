import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/shared/lib/auth/server";
import { canAccess } from "@/modules/auth/services/access-service";
import type { Permission } from "@/modules/auth/permissions";

export async function getPrincipal(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    role: session.user.role,
    enabled: session.user.enabled,
  };
}

export async function requirePageAccess(permission: Permission = "panel:read") {
  const principal = await getPrincipal(await headers());
  if (!canAccess(principal, permission)) redirect("/login");
  return principal!;
}
