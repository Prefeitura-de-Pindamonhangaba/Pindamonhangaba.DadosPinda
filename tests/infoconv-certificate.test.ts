import { checkIntegrationConfiguration } from "../src/shared/lib/deployment/preflight";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createServer, Agent, get } from "node:https";
import type { TLSSocket } from "node:tls";
import { loadInfoconvTlsOptions } from "../src/modules/data-sources/infoconv/certificate";

let directory: string;
const password = "fictitious-pfx-test-password";
async function openssl(args: string[]) {
  const process = Bun.spawn(["openssl", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  if ((await process.exited) !== 0)
    throw new Error("Falha ao gerar certificado fictício para teste TLS.");
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "pinda-certificate-tests-"));
  await openssl([
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    join(directory, "key.pem"),
    "-out",
    join(directory, "cert.pem"),
    "-days",
    "2",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ]);
  await writeFile(
    join(directory, "identity.pem"),
    Buffer.concat([
      await readFile(join(directory, "cert.pem")),
      await readFile(join(directory, "key.pem")),
    ]),
  );
  await openssl([
    "pkcs12",
    "-export",
    "-inkey",
    join(directory, "key.pem"),
    "-in",
    join(directory, "cert.pem"),
    "-out",
    join(directory, "identity.pfx"),
    "-passout",
    "pass:" + password,
  ]);
  await writeFile(
    join(directory, "identity.P12"),
    await readFile(join(directory, "identity.pfx")),
  );
  await writeFile(join(directory, "invalid.pfx"), "not a certificate");
  await openssl([
    "pkcs12",
    "-export",
    "-nokeys",
    "-in",
    join(directory, "cert.pem"),
    "-out",
    join(directory, "no-key.pfx"),
    "-passout",
    "pass:" + password,
  ]);
}, 30000);
afterAll(async () => {
  if (!directory) return;
  const root = resolve(tmpdir()) + sep;
  if (
    !resolve(directory).startsWith(root) ||
    !basename(directory).startsWith("pinda-certificate-tests-")
  )
    throw new Error("Pasta temporária inesperada.");
  await rm(directory, { recursive: true, force: true });
});

const configuration = (file: string, passphrase = password) => ({
  certificatePath: join(directory, file),
  format: "auto" as const,
  passphrase,
  caPath: join(directory, "cert.pem"),
});

test("PFX e P12 são abertos nativamente e mantêm verificação TLS", async () => {
  for (const file of ["identity.pfx", "identity.P12"]) {
    const options = await loadInfoconvTlsOptions(configuration(file));
    expect(options.pfx).toBeInstanceOf(Buffer);
    expect(options.cert).toBeUndefined();
    expect(options.key).toBeUndefined();
    expect(options.rejectUnauthorized).toBe(true);
    expect(options.minVersion).toBe("TLSv1.2");
  }
});
test("senha incorreta, formato inválido e arquivos ausentes falham sem expor segredo", async () => {
  for (const config of [
    configuration("identity.pfx", "incorrect-password-never-log"),
    configuration("invalid.pfx"),
    configuration("no-key.pfx"),
    configuration("missing.pfx"),
  ]) {
    try {
      await loadInfoconvTlsOptions(config);
      throw new Error("Teste deveria falhar.");
    } catch (error) {
      expect(String(error)).not.toContain("incorrect-password-never-log");
      expect(String(error)).toMatch(
        /Certificado Infoconv inválido|arquivo ausente/,
      );
    }
  }
});
test("PEM permanece compatível e rejeita certificado fora da validade", async () => {
  const config = configuration("identity.pem", "");
  const options = await loadInfoconvTlsOptions(config);
  expect(options.cert).toBeInstanceOf(Buffer);
  expect(options.key).toBeInstanceOf(Buffer);
  expect(options.pfx).toBeUndefined();
  await expect(
    loadInfoconvTlsOptions(config, new Date("2100-01-01")),
  ).rejects.toThrow("validade");
  await expect(
    loadInfoconvTlsOptions(config, new Date("2000-01-01")),
  ).rejects.toThrow("validade");
});
test("formato explícito substitui autodetecção de extensão", async () => {
  await writeFile(
    join(directory, "identity.bin"),
    await readFile(join(directory, "identity.pfx")),
  );
  await expect(
    loadInfoconvTlsOptions({ ...configuration("identity.bin"), format: "pfx" }),
  ).resolves.toMatchObject({ rejectUnauthorized: true });
  await expect(
    loadInfoconvTlsOptions({ ...configuration("identity.pfx"), format: "pem" }),
  ).rejects.toThrow("Certificado Infoconv inválido");
});
test("mTLS real local envia a identidade PFX com validação do servidor", async () => {
  const certificate = await readFile(join(directory, "cert.pem"));
  const server = createServer(
    {
      key: await readFile(join(directory, "key.pem")),
      cert: certificate,
      ca: certificate,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    (request, response) => {
      response.end(
        (request.socket as TLSSocket).authorized ? "authorized" : "denied",
      );
    },
  );
  const agent = new Agent(
    await loadInfoconvTlsOptions(configuration("identity.pfx")),
  );
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Servidor TLS indisponível.");
    const result = await new Promise<string>((resolve, reject) => {
      const request = get(
        { hostname: "127.0.0.1", port: address.port, agent, timeout: 5000 },
        (response) => {
          let body = "";
          response.on("data", (chunk) => {
            body += String(chunk);
          });
          response.on("end", () => resolve(body));
        },
      );
      request.on("error", reject);
      request.on("timeout", () =>
        request.destroy(new Error("Timeout no teste TLS local.")),
      );
    });
    expect(result).toBe("authorized");
  } finally {
    agent.destroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}, 15000);

test("pré-deploy aceita PFX e recusa senha incorreta sem consultar o SERPRO", async () => {
  const env = {
    INFOCONV_ENABLED: "true",
    INFOCONV_CACHE_KEY: "ab".repeat(32),
    INFOCONV_AUDIT_KEY: "cd".repeat(32),
    INFOCONV_CERTIFICATE_FORMAT: "pfx",
    INFOCONV_CERTIFICATE_PATH: join(directory, "identity.pfx"),
    INFOCONV_CERTIFICATE_PASSPHRASE: password,
    INFOCONV_CA_PATH: join(directory, "cert.pem"),
    INFOCONV_REQUESTER_CPF: "11144477735",
    INFOCONV_CPF_WSDL:
      "https://acesso.infoconv.receita.fazenda.gov.br/ws/cpf/consultarcpf.asmx?wsdl",
    INFOCONV_CNPJ_WSDL:
      "https://acesso.infoconv.receita.fazenda.gov.br/ws/cnpj/consultarcnpj.asmx?wsdl",
  };
  await expect(checkIntegrationConfiguration(env)).resolves.toBeUndefined();
  await expect(
    checkIntegrationConfiguration({
      ...env,
      INFOCONV_CERTIFICATE_PASSPHRASE: "wrong",
    }),
  ).rejects.toThrow("INFOCONV_CERTIFICATE_PASSPHRASE");
});
