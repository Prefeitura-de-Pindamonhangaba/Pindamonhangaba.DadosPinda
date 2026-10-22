import { defineConfig } from "drizzle-kit";
import { parseEnvironment } from "./src/shared/lib/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/**/models/*-schema.ts",
  out: "./drizzle",
  dbCredentials: { url: parseEnvironment(process.env).DATABASE_URL },
  strict: true,
});
