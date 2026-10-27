import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { parseAuthEnvironment } from "../src/shared/lib/env";
import { createKeycloakBindingRepository } from "../src/modules/users/models/keycloak-binding-repository";
import { manageKeycloakBinding } from "../src/modules/users/services/keycloak-binding-service";

let client: ReturnType<typeof postgres> | undefined;
try {
  const env = parseAuthEnvironment(process.env);
  client = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
  await manageKeycloakBinding(
    createKeycloakBindingRepository(drizzle(client)),
    JSON.parse(await Bun.stdin.text()),
    env.keycloak,
  );
  console.log(
    "Vínculo Keycloak atualizado; sessões locais do usuário revogadas e operação auditada.",
  );
} catch {
  console.error(
    "Não foi possível atualizar o vínculo. Confira configuração, UUIDs de administrador/usuário ativos, subject e eventual vínculo existente. Nenhuma identidade pode pertencer a duas contas.",
  );
  process.exitCode = 1;
} finally {
  await client?.end();
}
