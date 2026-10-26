import { resolveDeployment } from "../src/shared/lib/deployment/config";

try {
  const deployment = resolveDeployment(process.env);
  const child = Bun.spawn(["bun", "run", "start"], {
    env: deployment.environment,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.on(signal, () => child.kill(signal));
  process.exitCode = await child.exited;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Falha na configuração do deploy.",
  );
  process.exitCode = 1;
}
