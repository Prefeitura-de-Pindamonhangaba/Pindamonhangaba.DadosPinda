import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { parseEnvironment } from "../src/shared/lib/env";
import { createUserRepository } from "../src/modules/users/models/user-repository";
import { manageUser } from "../src/modules/users/services/manage-user-service";

const client = postgres(parseEnvironment(process.env).DATABASE_URL, { max: 1 });
try {
  const input: unknown = JSON.parse(await Bun.stdin.text());
  await manageUser(createUserRepository(drizzle(client)), input);
  console.log("Acesso atualizado e sessões revogadas.");
} catch {
  console.error(
    "Não foi possível atualizar o acesso. Verifique os dados e a disponibilidade do banco.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
