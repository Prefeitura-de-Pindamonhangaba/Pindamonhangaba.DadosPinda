import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import type { createUserRepository } from "@/modules/users/models/user-repository";

const managementSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("disable"),
    email: z.email().transform((value) => value.toLowerCase()),
  }),
  z.object({
    action: z.literal("reset-password"),
    email: z.email().transform((value) => value.toLowerCase()),
    password: z.string().min(12).max(128),
  }),
]);

export async function manageUser(
  repository: ReturnType<typeof createUserRepository>,
  input: unknown,
) {
  const parsed = managementSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados administrativos inválidos.");
  const data = parsed.data;
  await repository.changeAccess({
    email: data.email,
    action: data.action,
    passwordHash:
      data.action === "reset-password"
        ? await hashPassword(data.password)
        : undefined,
  });
}
