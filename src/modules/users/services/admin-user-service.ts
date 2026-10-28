import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";
import { provisionUserSchema } from "@/modules/auth/schemas/login-schema";
import type { createAdminUserRepository } from "../models/admin-user-repository";
export function listAdminUsers(
  repository: ReturnType<typeof createAdminUserRepository>,
) {
  return repository.list();
}

export const createUserProfileSchema = provisionUserSchema.omit({
  password: true,
});

export const updateUserSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  role: z.enum(["viewer", "operator", "admin"]),
  enabled: z.boolean(),
});
export const userProfileImportSchema = z.object({
  action: z.literal("import"),
  items: z
    .array(provisionUserSchema.omit({ password: true }))
    .min(1)
    .max(100),
});

export async function createAdminUser(
  repository: ReturnType<typeof createAdminUserRepository>,
  input: z.infer<typeof createUserProfileSchema>,
  actorId: string,
) {
  return repository.create(
    {
      ...input,
      passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
    },
    actorId,
  );
}
export async function updateAdminUser(
  repository: ReturnType<typeof createAdminUserRepository>,
  input: z.infer<typeof updateUserSchema>,
  actorId: string,
) {
  await repository.update(input, actorId);
}

export async function importUserProfiles(
  repository: ReturnType<typeof createAdminUserRepository>,
  input: z.infer<typeof userProfileImportSchema>,
  actorId: string,
) {
  const items = [];
  for (const profile of input.items)
    items.push({
      ...profile,
      passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
    });
  return repository.importProfiles(items, actorId);
}
export async function exportUserProfiles(
  repository: ReturnType<typeof createAdminUserRepository>,
  actorId: string,
) {
  const users = await repository.list();
  await repository.recordExport(actorId);
  return users;
}
