import "server-only";
import { getDatabase } from "@/shared/lib/db/client";
import { createAdminUserRepository } from "@/modules/users/models/admin-user-repository";
import { listAdminUsers } from "@/modules/users/services/admin-user-service";
export function listManagedUsers() {
  return listAdminUsers(createAdminUserRepository(getDatabase()));
}
