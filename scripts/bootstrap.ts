import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { user } from "../src/modules/auth/models/auth-schema";
import { provisionUserSchema } from "../src/modules/auth/schemas/login-schema";
import { createUserRepository } from "../src/modules/users/models/user-repository";
import { provisionUser } from "../src/modules/users/services/provision-user-service";
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
      const admins = await database
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "admin"), eq(user.enabled, true)))
        .limit(1);
      if (!admins.length)
        throw new Error(
          "Nenhum administrador ativo. Provisione uma conta admin: docker compose run --rm -T tools users:create (JSON pela entrada padrão; veja docs/operacao.md).",
        );
      console.log(
        "Pré-deploy aprovado: configuração, conexão, migrações e administrador verificados. Confirme HTTPS no proxy e backup antes de publicar. Infoconv não foi consultado.",
      );
      return;
    }
    await client`select pg_advisory_lock(190023, 1)`;
    try {
      await migrate(database, { migrationsFolder: "./drizzle" });
      const existing = await database
        .select({ id: user.id })
        .from(user)
        .limit(1);
      if (!existing.length) {
        const input = provisionUserSchema.safeParse({
          name: process.env.INITIAL_ADMIN_NAME,
          email: process.env.INITIAL_ADMIN_EMAIL,
          password: process.env.INITIAL_ADMIN_PASSWORD,
          role: "admin",
        });
        if (!input.success)
          throw new Error(
            "Configure INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD (12 a 128 caracteres) para preparar o primeiro banco local.",
          );
        await provisionUser(createUserRepository(database), input.data);
        console.log(
          "Banco de desenvolvimento preparado e administrador inicial criado.",
        );
      } else
        console.log(
          "Banco de desenvolvimento pronto; contas e senhas existentes preservadas.",
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
