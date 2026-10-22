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

export const updateUserSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  role: z.enum(["viewer", "operator", "admin"]),
  enabled: z.boolean(),
  password: z.string().min(12).max(128).optional(),
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
  input: z.infer<typeof provisionUserSchema>,
  actorId: string,
) {
  const { password, ...profile } = input;
  return repository.create(
    { ...profile, passwordHash: await hashPassword(password) },
    actorId,
  );
}
export async function updateAdminUser(
  repository: ReturnType<typeof createAdminUserRepository>,
  input: z.infer<typeof updateUserSchema>,
  actorId: string,
) {
  const { password, ...profile } = input;
  await repository.update(
    {
      ...profile,
      passwordHash: password ? await hashPassword(password) : undefined,
    },
    actorId,
  );
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
