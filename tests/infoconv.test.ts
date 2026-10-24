import { describe, expect, test, mock } from "bun:test";
import {
  isValidDocument,
  parseDocumentList,
  consultationSchema,
} from "../src/modules/consultations/schemas/consultation-schema";
import { parseSoapResponse } from "../src/modules/data-sources/infoconv/transports/soap/response-schema";
import { parseInfoconvEnvironment } from "../src/modules/data-sources/infoconv/env";
import { assertOfficialInfoconvUrl } from "../src/modules/data-sources/infoconv/transports/soap/soap-client";
import {
  encryptCache,
  decryptCache,
} from "../src/modules/consultations/services/cache-crypto";
import {
  consultDocument,
  CACHE_RETENTION_MS,
} from "../src/modules/consultations/services/consultation-service";
import type { ConsultationRepository } from "../src/modules/consultations/models/consultation-repository";
import {
  ConsultationError,
  type ConsultationResult,
  type ProfileData,
} from "../src/modules/consultations/models/consultation-types";
import {
  signResult,
  verifyResult,
} from "../src/modules/consultations/services/result-proof";
import { exportResultsCsv } from "../src/modules/consultations/services/result-format";
import {
  parseReferenceCsv,
  exportReferenceCsv,
} from "../src/modules/reference-data/services/reference-service";

export const testInfoconvEnv = parseInfoconvEnvironment({
  INFOCONV_ENABLED: "false",
  INFOCONV_CERTIFICATE_PATH: "test-only.pem",
  INFOCONV_REQUESTER_CPF: "11144477735",
  INFOCONV_CPF_WSDL:
    "https://acesso.infoconv.receita.fazenda.gov.br/ws/cpf/consultarcpf.asmx?wsdl",
  INFOCONV_CNPJ_WSDL:
    "https://acesso.infoconv.receita.fazenda.gov.br/ws/cnpj/consultarcnpj.asmx?wsdl",
  INFOCONV_CACHE_KEY: "ab".repeat(32),
  INFOCONV_AUDIT_KEY: "cd".repeat(32),
});
const principal = {
  id: crypto.randomUUID(),
  name: "Pessoa fictícia",
  role: "operator",
  enabled: true,
};
const input = consultationSchema.parse({
  kind: "cpf",
  document: "11144477735",
  purpose: "Teste de fiscalização administrativa",
  batchId: crypto.randomUUID(),
});

function setup() {
  type CacheRow = NonNullable<
    Awaited<ReturnType<ConsultationRepository["findCache"]>>
  >;
  const cache = new Map<string, CacheRow>();
  const audits: { id: string; status?: string; origin: string }[] = [];
  const repository: ConsultationRepository = {
    async purgeExpired() {
      for (const [key, row] of cache)
        if (row.expiresAt.getTime() <= Date.now()) cache.delete(key);
    },
    async findCache(key) {
      return cache.get(key);
    },
    async saveCache(row) {
      cache.set(row.key, row);
    },
    async reserve(row) {
      const id = crypto.randomUUID();
      audits.push({ id, status: row.status ?? "pending", origin: row.origin });
      return id;
    },
    async complete(id, status) {
      const row = audits.find((item) => item.id === id);
      if (row) row.status = status;
    },
    async listAudit() {
      return [];
    },
    async usage() {
      return [];
    },
    async ownsRecords() {
      return true;
    },
  };
  const consult = mock(
    async (
      _kind: string,
      document: string,
    ): Promise<{ data: ProfileData }> => ({
      data: { CPF: document, Nome: "PESSOA FICTÍCIA", NomeMae: "MÃE FICTÍCIA" },
    }),
  );
  return { cache, audits, repository, adapter: { consult } };
}

describe("contratos e validação Infoconv", () => {
  test("valida CPF e CNPJ numérico ou alfanumérico sem remover letras", () => {
    expect(isValidDocument("cpf", "111.444.777-35")).toBe(true);
    expect(isValidDocument("cpf", "11111111111")).toBe(false);
    expect(isValidDocument("cnpj", "04.252.011/0001-10")).toBe(true);
    expect(isValidDocument("cnpj", "12.ABC.345/01DE-35")).toBe(true);
    expect(isValidDocument("cnpj", "12.ABC.345/01DE-36")).toBe(false);
    expect(() =>
      parseDocumentList("cpf", "11144477735\n111.444.777-35"),
    ).not.toThrow();
    expect(
      parseDocumentList("cpf", "11144477735\n111.444.777-35"),
    ).toHaveLength(1);
    expect(() => parseDocumentList("cpf", "11144477735\n000")).toThrow(
      "linha 2",
    );
  });
  test("respostas mantêm campos do perfil e rejeitam documento divergente", () => {
    const response = {
      ConsultarCPFPDEC8789Result: {
        PessoaPerfilDEC8789: [{ CPF: input.document, Nome: "PESSOA FICTÍCIA" }],
      },
    };
    expect(parseSoapResponse("cpf", input.document, response).Nome).toBe(
      "PESSOA FICTÍCIA",
    );
    expect(() => parseSoapResponse("cpf", "52998224725", response)).toThrow(
      "invalid_response",
    );
    expect(() =>
      parseSoapResponse("cpf", input.document, { unexpected: true }),
    ).toThrow("invalid_response");
    expect(() =>
      parseSoapResponse("cpf", input.document, {
        ConsultarCPFPDEC8789Result: {
          PessoaPerfilDEC8789: {
            CPF: input.document,
            Erro: "CPF - Erro 04 – CPF não encontrado.",
          },
        },
      }),
    ).toThrow("not_found");
  });
  test("CNPJ preserva CNAEs secundários e sócios do contrato oficial", () => {
    const data = parseSoapResponse("cnpj", "04252011000110", {
      ConsultarCNPJPDEC8789Result: {
        CNPJPerfilDEC8789: {
          CNPJ: "04252011000110",
          NomeEmpresarial: "EMPRESA FICTÍCIA",
          CNAESecundario: { string: ["0000000", "0000001"] },
          Sociedade: {
            SocioPerfilDEC8789: [
              { Nome: "SÓCIO FICTÍCIO", Numero: "00000000000" },
            ],
          },
        },
      },
    });
    expect(data.CNAESecundario).toEqual(["0000000", "0000001"]);
    expect(Array.isArray(data.Sociedade) && data.Sociedade.length).toBe(1);
  });
  test("endpoints arbitrários, HTTP e redirecionamentos não são aceitos", () => {
    expect(() =>
      assertOfficialInfoconvUrl("http://127.0.0.1/secret"),
    ).toThrow();
    expect(() =>
      assertOfficialInfoconvUrl(
        "https://evil.example/ws/cpf/consultarcpf.asmx",
      ),
    ).toThrow();
    expect(() =>
      assertOfficialInfoconvUrl(
        "https://acesso.infoconv.receita.fazenda.gov.br/ws/cpf/consultarcpf.asmx?wsdl",
      ),
    ).not.toThrow();
  });
});

describe("cache criptografado e consumo", () => {
  test("duas consultas iguais fazem apenas uma chamada à fonte e auditam ambas", async () => {
    const { repository, adapter, audits, cache } = setup();
    const first = await consultDocument(
      repository,
      adapter,
      testInfoconvEnv,
      principal,
      input,
    );
    const second = await consultDocument(
      repository,
      adapter,
      testInfoconvEnv,
      principal,
      input,
    );
    expect(adapter.consult).toHaveBeenCalledTimes(1);
    expect(first.origin).toBe("serpro");
    expect(second.origin).toBe("cache");
    expect(first.data).toEqual(second.data);
    expect(audits).toHaveLength(2);
    const row = [...cache.values()][0];
    expect(row.ciphertext).not.toContain("FICTÍCIA");
    expect(row.key).not.toContain(input.document);
    expect(row.expiresAt.getTime() - row.obtainedAt.getTime()).toBe(
      CACHE_RETENTION_MS,
    );
  });
  test("alterar a validade do cache invalida a autenticação sem consumir o SERPRO", async () => {
    const { repository, adapter, cache } = setup();
    await consultDocument(
      repository,
      adapter,
      testInfoconvEnv,
      principal,
      input,
    );
    for (const row of cache.values())
      row.expiresAt = new Date(row.expiresAt.getTime() + 1000);
    const result = await consultDocument(
      repository,
      adapter,
      testInfoconvEnv,
      principal,
      input,
    );
    expect(result.status).toBe("unavailable");
    expect(adapter.consult).toHaveBeenCalledTimes(1);
  });
  test("dados expirados são removidos e uma nova consulta é necessária", async () => {
    const { repository, adapter, cache } = setup();
    await consultDocument(
      repository,
      adapter,
      testInfoconvEnv,
      principal,
      input,
    );
    for (const row of cache.values()) row.expiresAt = new Date(0);
    const result = await consultDocument(
      repository,
      adapter,
      testInfoconvEnv,
      principal,
      input,
    );
    expect(adapter.consult).toHaveBeenCalledTimes(2);
    expect(result.origin).toBe("serpro");
  });
  test("adulteração e troca de contexto são detectadas sem chamada extra", async () => {
    const encrypted = encryptCache(
      testInfoconvEnv.INFOCONV_CACHE_KEY,
      "cpf:key",
      { secret: "fictício" },
    );
    expect(() =>
      decryptCache(testInfoconvEnv.INFOCONV_CACHE_KEY, "outro", encrypted),
    ).toThrow();
    const { repository, adapter, cache } = setup();
    await consultDocument(
      repository,
      adapter,
      testInfoconvEnv,
      principal,
      input,
    );
    for (const row of cache.values()) row.ciphertext = encrypted;
    expect(
      (
        await consultDocument(
          repository,
          adapter,
          testInfoconvEnv,
          principal,
          input,
        )
      ).status,
    ).toBe("unavailable");
    expect(adapter.consult).toHaveBeenCalledTimes(1);
  });
  test("papéis e atualização forçada são verificados antes de consultar", async () => {
    const { repository, adapter } = setup();
    await expect(
      consultDocument(
        repository,
        adapter,
        testInfoconvEnv,
        { ...principal, role: "viewer" },
        input,
      ),
    ).rejects.toThrow("forbidden");
    await expect(
      consultDocument(repository, adapter, testInfoconvEnv, principal, {
        ...input,
        forceRefresh: true,
      }),
    ).rejects.toThrow("forbidden");
    expect(adapter.consult).toHaveBeenCalledTimes(0);
    await consultDocument(
      repository,
      adapter,
      testInfoconvEnv,
      { ...principal, role: "admin" },
      input,
    );
    await consultDocument(
      repository,
      adapter,
      testInfoconvEnv,
      { ...principal, role: "admin" },
      { ...input, forceRefresh: true },
    );
    expect(adapter.consult).toHaveBeenCalledTimes(2);
  });
  test("falhas não são guardadas como cadastro e possuem resultado operacional", async () => {
    const { repository, cache, audits } = setup();
    const result = await consultDocument(
      repository,
      {
        async consult() {
          throw new ConsultationError("not_found");
        },
      },
      testInfoconvEnv,
      principal,
      input,
    );
    expect(result.status).toBe("not_found");
    expect(cache.size).toBe(0);
    expect(audits[0].status).toBe("not_found");
  });
  test("exportação assinada não aceita dados alterados e protege fórmulas", () => {
    const result: ConsultationResult = {
      id: crypto.randomUUID(),
      batchId: crypto.randomUUID(),
      kind: "cpf",
      document: input.document,
      status: "success",
      origin: "mock",
      obtainedAt: new Date().toISOString(),
      data: { Nome: '=HYPERLINK("https://example.org")' },
    };
    result.proof = signResult(testInfoconvEnv.INFOCONV_AUDIT_KEY, result);
    expect(verifyResult(testInfoconvEnv.INFOCONV_AUDIT_KEY, result)).toBe(true);
    expect(exportResultsCsv([result])).toContain("'=HYPERLINK");
    expect(
      verifyResult(testInfoconvEnv.INFOCONV_AUDIT_KEY, {
        ...result,
        data: { Nome: "Outro" },
      }),
    ).toBe(false);
  });
  test("CSV de domínios preserva separadores, aspas e quebras de linha", () => {
    const values = [
      { type: "SETOR", code: "01", label: 'Unidade; "teste"\nLinha 2' },
    ];
    expect(parseReferenceCsv(exportReferenceCsv(values))).toEqual(values);
  });
});
