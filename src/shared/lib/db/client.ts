import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseEnvironment } from "@/shared/lib/env";

type Database = ReturnType<typeof createDatabase>;
const databaseGlobal = globalThis as typeof globalThis & {
  pindaDatabase?: Database;
};

function createDatabase() {
  const env = parseEnvironment(process.env);
  const client = postgres(env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client);
}

export function getDatabase() {
  databaseGlobal.pindaDatabase ??= createDatabase();
  return databaseGlobal.pindaDatabase;
}
