import { hashPassword } from "better-auth/crypto";
import { provisionUserSchema } from "@/modules/auth/schemas/login-schema";
import type { createUserRepository } from "@/modules/users/models/user-repository";

export async function provisionUser(
  repository: ReturnType<typeof createUserRepository>,
  input: unknown,
) {
  const parsed = provisionUserSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      "Informe nome, e-mail, papel válido e senha de 12 a 128 caracteres.",
    );
  const { password, ...profile } = parsed.data;
  return repository.create({
    ...profile,
    passwordHash: await hashPassword(password),
  });
}
