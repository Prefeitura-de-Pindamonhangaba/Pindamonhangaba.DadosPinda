import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseInfoconvEnvironment } from "../src/modules/data-sources/infoconv/env";
import { createInfoconvAdapter } from "../src/modules/data-sources/infoconv/adapter-factory";
import { parseSoapEnvironment } from "../src/modules/data-sources/infoconv/transports/soap/env";
import { SoapInfoconvAdapter } from "../src/modules/data-sources/infoconv/transports/soap/soap-adapter";
import { normalizeInfoconvProfile } from "../src/modules/data-sources/infoconv/profile-schema";
import { ConsultationError } from "../src/modules/consultations/models/consultation-types";
import { documentDigest } from "../src/modules/consultations/services/cache-crypto";

test("cache anterior mantém a mesma chave de busca após isolar o protocolo", () => {
  expect(documentDigest("cd".repeat(32), "cpf", "11144477735")).toBe(
    "32a05641a176ac22bd351c8f3e97a29bde77fb96e4dede1926309dc6aaa858af",
  );
});

const config = {
  INFOCONV_CACHE_KEY: "ab".repeat(32),
  INFOCONV_AUDIT_KEY: "cd".repeat(32),
};
const soapConfig = {
  INFOCONV_CERTIFICATE_PATH: "test-only.pem",
  INFOCONV_REQUESTER_CPF: "11144477735",
  INFOCONV_CPF_WSDL:
    "https://acesso.infoconv.receita.fazenda.gov.br/ws/cpf/consultarcpf.asmx?wsdl",
  INFOCONV_CNPJ_WSDL:
    "https://acesso.infoconv.receita.fazenda.gov.br/ws/cnpj/consultarcnpj.asmx?wsdl",
};
test("configuração comum não exige SOAP e protocolo não implementado falha explicitamente", async () => {
  const env = parseInfoconvEnvironment(config);
  expect(env.INFOCONV_TRANSPORT).toBe("soap");
  expect(
    Object.keys(env).some(
      (key) => key.includes("WSDL") || key.includes("CERTIFICATE"),
    ),
  ).toBe(false);
  expect(() =>
    parseInfoconvEnvironment({ ...config, INFOCONV_TRANSPORT: "rest" }),
  ).toThrow("INFOCONV_TRANSPORT");
  expect(() => parseSoapEnvironment({})).toThrow(
    "Configuração Infoconv SOAP inválida",
  );
  expect(() =>
    parseSoapEnvironment({
      ...soapConfig,
      INFOCONV_CPF_WSDL: "http://127.0.0.1/private",
    }),
  ).toThrow("INFOCONV_CPF_WSDL");
  const adapter = await createInfoconvAdapter(env, soapConfig);
  expect(adapter).toBeInstanceOf(SoapInfoconvAdapter);
});
test("adapter SOAP normaliza dados e não propaga XML, falhas de transporte ou credenciais", async () => {
  const document = "11144477735";
  const adapter = new SoapInfoconvAdapter({
    async request() {
      return {
        ConsultarCPFPDEC8789Result: {
          PessoaPerfilDEC8789: { CPF: document, Nome: "PESSOA FICTÍCIA" },
        },
      };
    },
  });
  const { data } = await adapter.consult("cpf", document);
  expect(data.CPF).toBe(document);
  expect(data.Nome).toBe("PESSOA FICTÍCIA");
  expect(
    Object.keys(data).some(
      (key) => key.includes("Result") || key.includes("Perfil"),
    ),
  ).toBe(false);
  const failure = new SoapInfoconvAdapter({
    async request() {
      throw new Error("<SoapFault>segredo-ficticio</SoapFault>");
    },
  });
  await expect(failure.consult("cpf", document)).rejects.toThrow("unavailable");
  const notFound = new SoapInfoconvAdapter({
    async request() {
      throw new ConsultationError("not_found");
    },
  });
  await expect(notFound.consult("cpf", document)).rejects.toThrow("not_found");
});
test("contrato normalizado é independente de envelope e preserva proteção de documento e formato", () => {
  const input = {
    CPF: "11144477735",
    Nome: "FICTÍCIO",
    Sociedade: [{ Nome: "FICTÍCIO" }],
  };
  expect(normalizeInfoconvProfile("cpf", input.CPF, input)).toEqual(input);
  expect(() => normalizeInfoconvProfile("cpf", "52998224725", input)).toThrow(
    "invalid_response",
  );
  expect(() =>
    normalizeInfoconvProfile("cpf", input.CPF, { Nome: "FICTÍCIO" }),
  ).toThrow("invalid_response");
  expect(() =>
    normalizeInfoconvProfile("cpf", input.CPF, {
      ...input,
      envelope: { value: "SOAP" },
    }),
  ).toThrow("invalid_response");
});
test("serviços, controllers e schemas de consulta não importam SOAP nem classes concretas", async () => {
  async function sources(path: string): Promise<string[]> {
    const entries = await readdir(path, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? sources(join(path, entry.name))
          : entry.name.endsWith(".ts")
            ? [join(path, entry.name)]
            : [],
      ),
    );
    return nested.flat();
  }
  for (const path of [
    ...(await sources("src/modules/consultations")),
    "src/shared/lib/consultations/server.ts",
  ]) {
    const code = await readFile(path, "utf8");
    expect(code).not.toMatch(
      /from\s+["'][^"']*(?:transports\/soap|\/soap-adapter|\/soap-client|\/mock-adapter)["']/,
    );
    expect(code).not.toMatch(/from\s+["']soap["']/);
  }
});
