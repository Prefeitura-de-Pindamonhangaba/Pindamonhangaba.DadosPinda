import "server-only";
import { getDatabase } from "@/shared/lib/db/client";
import { createAdminUserRepository } from "@/modules/users/models/admin-user-repository";
import {
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
  importUserProfiles,
  exportUserProfiles,
  type userProfileImportSchema,
  type updateUserSchema,
} from "@/modules/users/services/admin-user-service";
import type { provisionUserSchema } from "@/modules/auth/schemas/login-schema";
import type { z } from "zod";

export function listManagedUsers() {
  return listAdminUsers(createAdminUserRepository(getDatabase()));
}
export function provisionManagedUser(
  input: z.infer<typeof provisionUserSchema>,
  actorId: string,
) {
  return createAdminUser(
    createAdminUserRepository(getDatabase()),
    input,
    actorId,
  );
}
export function updateManagedUser(
  input: z.infer<typeof updateUserSchema>,
  actorId: string,
) {
  return updateAdminUser(
    createAdminUserRepository(getDatabase()),
    input,
    actorId,
  );
}
export function importManagedUsers(
  input: z.infer<typeof userProfileImportSchema>,
  actorId: string,
) {
  return importUserProfiles(
    createAdminUserRepository(getDatabase()),
    input,
    actorId,
  );
}
export function exportManagedUsers(actorId: string) {
  return exportUserProfiles(createAdminUserRepository(getDatabase()), actorId);
}
