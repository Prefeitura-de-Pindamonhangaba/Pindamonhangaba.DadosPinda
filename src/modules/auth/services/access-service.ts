import { hasPermission, type Permission } from "@/modules/auth/permissions";

export type Principal = {
  id: string;
  name: string;
  role: string;
  enabled: boolean;
};

export function canAccess(
  principal: Principal | null,
  permission: Permission,
): boolean {
  return Boolean(
    principal?.enabled && hasPermission(principal.role, permission),
  );
}
