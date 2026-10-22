import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { parseEnvironment } from "../src/shared/lib/env";
import { createUserRepository } from "../src/modules/users/models/user-repository";
import { provisionUser } from "../src/modules/users/services/provision-user-service";

const client = postgres(parseEnvironment(process.env).DATABASE_URL, { max: 1 });
try {
  // JSON pela entrada padrão evita senhas no histórico e nos argumentos do processo.
  const input: unknown = JSON.parse(await Bun.stdin.text());
  const result = await provisionUser(
    createUserRepository(drizzle(client)),
    input,
  );
  console.log(`Usuário provisionado: ${result.id}`);
} catch {
  console.error(
    "Não foi possível provisionar o usuário. Verifique os campos, a disponibilidade do banco, as migrações e se o e-mail já existe.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
