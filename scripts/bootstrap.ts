import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { parseAuthEnvironment, isLoopbackUrl } from "../src/shared/lib/env";
import { user } from "../src/modules/auth/models/auth-schema";
import { createUserRepository } from "../src/modules/users/models/user-repository";
import { provisionUser } from "../src/modules/users/services/provision-user-service";

const env = parseAuthEnvironment(process.env);
// Produção mantém migrações sob controle do operador, fora do startup.
if (env.ALLOW_LOCAL_HTTP !== "true" || !isLoopbackUrl(env.APP_URL)) {
  console.log(
    "Inicialização automática desabilitada. Aplique migrações e provisione contas pelo procedimento de produção.",
  );
  process.exit(0);
}
const client = postgres(env.DATABASE_URL, { max: 1 });
try {
  const database = drizzle(client);
  await migrate(database, { migrationsFolder: "./drizzle" });
  await client`select pg_advisory_lock(190023, 1)`;
  try {
    const existing = await database.select({ id: user.id }).from(user).limit(1);
    if (!existing.length) {
      await provisionUser(createUserRepository(database), {
        name: process.env.INITIAL_ADMIN_NAME,
        email: process.env.INITIAL_ADMIN_EMAIL,
        password: process.env.INITIAL_ADMIN_PASSWORD,
        role: "admin",
      });
      console.log("Conta administrativa inicial criada.");
    } else {
      console.log(
        "Banco existente preservado; credenciais não foram alteradas.",
      );
    }
  } finally {
    await client`select pg_advisory_unlock(190023, 1)`;
  }
} catch {
  console.error(
    "Falha na inicialização local. Verifique banco, migrações e INITIAL_ADMIN_NAME/EMAIL/PASSWORD no .env (senha de 12 a 128 caracteres).",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
