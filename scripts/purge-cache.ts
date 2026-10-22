import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { parseEnvironment } from "../src/shared/lib/env";
import { createConsultationRepository } from "../src/modules/consultations/models/consultation-repository";
const client = postgres(parseEnvironment(process.env).DATABASE_URL, { max: 1 });
try {
  await createConsultationRepository(drizzle(client)).purgeExpired();
  console.log("Cache expirado removido.");
} catch {
  console.error("Falha ao limpar o cache expirado.");
  process.exitCode = 1;
} finally {
  await client.end();
}
