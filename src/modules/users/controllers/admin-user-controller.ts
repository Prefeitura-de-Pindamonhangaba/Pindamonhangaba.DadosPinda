import "server-only";
import {
  authorizeRequest,
  privateJson,
  safeRequestError,
} from "@/shared/lib/security/request";
import { listManagedUsers } from "@/shared/lib/users/server";
import { requirePageAccess } from "@/modules/auth/controllers/access-controller";

export async function loadAdminUsersPage() {
  const principal = await requirePageAccess("users:manage");
  return {
    principal,
    users: (await listManagedUsers()).map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function handleAdminUsers(request: Request) {
  try {
    await authorizeRequest(request, "users:manage");
    if (request.method !== "GET")
      return privateJson(
        {
          message:
            "Gerencie cadastro, papéis e bloqueio de usuários no Keycloak.",
        },
        405,
      );
    return privateJson({
      managedBy: "keycloak",
      users: await listManagedUsers(),
    });
  } catch (error) {
    return safeRequestError(error);
  }
}
