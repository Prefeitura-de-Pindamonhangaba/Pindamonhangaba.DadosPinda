import "server-only";
import {
  authorizeRequest,
  privateJson,
  readJson,
  RequestError,
  safeRequestError,
} from "@/shared/lib/security/request";
import { UserManagementError } from "../models/admin-user-repository";
import {
  updateUserSchema,
  createUserProfileSchema,
  userProfileImportSchema,
} from "../services/admin-user-service";
import {
  listManagedUsers,
  provisionManagedUser,
  updateManagedUser,
  importManagedUsers,
  exportManagedUsers,
} from "@/shared/lib/users/server";
import { csvCell } from "@/shared/lib/csv";
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
    const principal = await authorizeRequest(request, "users:manage");
    if (request.method === "GET") {
      if (new URL(request.url).searchParams.get("format") === "csv") {
        const users = await exportManagedUsers(principal.id);
        const csv =
          "\ufeffname;email;role\r\n" +
          users
            .map((item) =>
              [item.name, item.email, item.role].map(csvCell).join(";"),
            )
            .join("\r\n");
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv;charset=utf-8",
            "Content-Disposition": "attachment; filename=servidores.csv",
            "Cache-Control": "private, no-store",
          },
        });
      }
      return privateJson({ users: await listManagedUsers() });
    }
    const body = await readJson(request, 100_000);
    if (request.method === "POST") {
      const imported = userProfileImportSchema.safeParse(body);
      if (imported.success) {
        const result = await importManagedUsers(imported.data, principal.id);
        return privateJson({
          message: `${result.created} conta(s) criada(s) desativada(s); ${result.skipped} já existente(s). Vincule ao Keycloak e ative individualmente.`,
          ...result,
        });
      }
      const parsed = createUserProfileSchema.safeParse(body);
      if (!parsed.success)
        throw new RequestError(400, "Verifique nome, e-mail e papel.");
      return privateJson(
        await provisionManagedUser(parsed.data, principal.id),
        201,
      );
    }
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success)
      throw new RequestError(400, "Dados de servidor inválidos.");
    await updateManagedUser(parsed.data, principal.id);
    return privateJson({
      message:
        "Servidor atualizado. Alterações de acesso revogam sessões existentes.",
    });
  } catch (error) {
    if (error instanceof UserManagementError)
      return privateJson(
        {
          message:
            error.code === "last_admin"
              ? "Mantenha pelo menos um administrador ativo."
              : "Servidor não encontrado.",
        },
        error.code === "last_admin" ? 409 : 404,
      );
    return safeRequestError(error);
  }
}
