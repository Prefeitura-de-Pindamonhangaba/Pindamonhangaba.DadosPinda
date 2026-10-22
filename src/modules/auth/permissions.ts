export type Permission =
  | "panel:read"
  | "consultations:read"
  | "consultations:cpf"
  | "consultations:cnpj"
  | "consultations:batch"
  | "consultations:export"
  | "consultations:refresh"
  | "sources:infoconv"
  | "audit:read"
  | "users:manage"
  | "references:manage";
export type Role = "viewer" | "operator" | "admin";

const rolePermissions: Record<Role, readonly Permission[]> = {
  viewer: ["panel:read"],
  operator: [
    "panel:read",
    "consultations:read",
    "consultations:cpf",
    "consultations:cnpj",
    "consultations:batch",
    "consultations:export",
    "sources:infoconv",
  ],
  admin: [
    "panel:read",
    "consultations:read",
    "consultations:cpf",
    "consultations:cnpj",
    "consultations:batch",
    "consultations:export",
    "consultations:refresh",
    "sources:infoconv",
    "audit:read",
    "users:manage",
    "references:manage",
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return (
    Object.hasOwn(rolePermissions, role) &&
    rolePermissions[role as Role].includes(permission)
  );
}
