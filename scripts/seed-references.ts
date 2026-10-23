import { z } from "zod";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import { parseEnvironment } from "../src/shared/lib/env";
import { user } from "../src/modules/auth/models/auth-schema";
import { createReferenceRepository } from "../src/modules/reference-data/models/reference-repository";
import { mutateReferences } from "../src/modules/reference-data/services/reference-service";
import data from "../docs/legacy-reference-data.json";

const client = postgres(parseEnvironment(process.env).DATABASE_URL, { max: 1 });
try {
  const actorId = z.uuid().parse(Bun.argv[Bun.argv.indexOf("--actor-id") + 1]);
  const db = drizzle(client);
  const [actor] = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(eq(user.id, actorId), eq(user.role, "admin"), eq(user.enabled, true)),
    )
    .limit(1);
  if (!actor) throw new Error("Administrador necessário.");
  await mutateReferences(
    createReferenceRepository(db),
    { action: "import", items: data },
    actor.id,
  );
  console.log(
    "Domínios de referência importados. Nenhum cadastro pessoal do legado foi migrado.",
  );
} catch {
  console.error(
    "Não foi possível importar os domínios. Informe --actor-id com UUID de administrador ativo e verifique banco e migrações.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
