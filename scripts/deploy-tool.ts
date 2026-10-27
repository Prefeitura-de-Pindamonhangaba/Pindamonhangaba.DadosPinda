import { resolveDeployment } from "../src/shared/lib/deployment/config";

const allowed = [
  "db:migrate",
  "users:create",
  "users:keycloak",
  "users:manage",
  "cache:purge",
  "references:seed",
];
try {
  const [command, ...args] = Bun.argv.slice(2);
  if (!allowed.includes(command))
    throw new Error(`Ferramentas disponíveis: ${allowed.join(", ")}.`);
  const { environment } = resolveDeployment(process.env);
  const child = Bun.spawn(["bun", "run", command, ...args], {
    env: environment,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exitCode = await child.exited;
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Falha na configuração das ferramentas.",
  );
  process.exitCode = 1;
}
