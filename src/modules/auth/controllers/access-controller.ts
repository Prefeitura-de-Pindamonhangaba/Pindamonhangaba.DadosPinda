import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getIdentityService } from "@/shared/lib/auth/server";
import { canAccess } from "@/modules/auth/services/access-service";
import type { Permission } from "@/modules/auth/permissions";

export async function getPrincipal(requestHeaders: Headers) {
  return getIdentityService()?.getPrincipal(requestHeaders) ?? null;
}

export async function requirePageAccess(permission: Permission = "panel:read") {
  const principal = await getPrincipal(await headers());
  if (!canAccess(principal, permission)) redirect("/login");
  return principal!;
}
