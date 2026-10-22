export type Permission = "panel:read";
export type Role = "viewer" | "admin";

const rolePermissions: Record<Role, readonly Permission[]> = {
  viewer: ["panel:read"],
  admin: ["panel:read"],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return (
    Object.hasOwn(rolePermissions, role) &&
    rolePermissions[role as Role].includes(permission)
  );
}
