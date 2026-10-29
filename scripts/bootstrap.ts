import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { resolveDeployment } from "../src/shared/lib/deployment/config";
import { checkIntegrationConfiguration } from "../src/shared/lib/deployment/preflight";

async function prepare() {
  const deployment = resolveDeployment(process.env);
  await checkIntegrationConfiguration(process.env);
  const client = postgres(deployment.databaseUrl, {
    max: 1,
    connect_timeout: 3,
    onnotice: () => {},
  });
  try {
    let connected = false;
    for (
      let attempt = 0;
      attempt < (deployment.production ? 1 : 20);
      attempt++
    ) {
      try {
        await client`select 1`;
        connected = true;
        break;
      } catch {
        if (!deployment.production) await Bun.sleep(1000);
      }
    }
    if (!connected)
      throw new Error(
        "Banco indisponível. Verifique DATABASE_URL em produção, credenciais, DNS, firewall e requisitos TLS. Em desenvolvimento confira os logs do serviço db.",
      );
    const database = drizzle(client);
    if (deployment.production) {
      let applied: { created_at: string }[];
      try {
        applied = await client<
          { created_at: string }[]
        >`select created_at from drizzle.__drizzle_migrations order by created_at, id`;
      } catch {
        throw new Error(
          "Banco sem migrações acessíveis. Execute: docker compose run --rm tools db:migrate",
        );
      }
      const expected = readMigrationFiles({ migrationsFolder: "./drizzle" });
      if (
        expected.length !== applied.length ||
        expected.some(
          (migration, i) =>
            migration.folderMillis !== Number(applied[i]?.created_at),
        )
      )
        throw new Error(
          "Migrações pendentes ou divergentes. Revise o banco e execute: docker compose run --rm tools db:migrate",
        );
      console.log(
        "Pré-deploy aprovado: configuração, conexão e migrações verificadas. Acesso administrado no Keycloak. Confirme HTTPS no proxy e backup antes de publicar. Infoconv não foi consultado.",
      );
      return;
    }
    await client`select pg_advisory_lock(190023, 1)`;
    try {
      await migrate(database, { migrationsFolder: "./drizzle" });
      console.log(
        "Banco de desenvolvimento pronto. Usuários e papéis serão sincronizados do Keycloak no login.",
      );
    } finally {
      await client`select pg_advisory_unlock(190023, 1)`;
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

prepare().catch((error: unknown) => {
  const message =
    error instanceof Error && !("severity" in error) && !("code" in error)
      ? error.message
      : "Falha na verificação do banco. Confira acesso, permissões e migrações sem compartilhar credenciais.";
  console.error(message);
  process.exitCode = 1;
});
