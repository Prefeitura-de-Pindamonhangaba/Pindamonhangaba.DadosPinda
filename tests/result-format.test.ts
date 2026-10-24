import { expect, test } from "bun:test";
import {
  formatField,
  formatDate,
  exportResultsCsv,
} from "../src/modules/consultations/services/result-format";
import { resultGroups } from "../src/modules/consultations/services/result-groups";
import {
  CPF_FIELDS,
  CNPJ_FIELDS,
} from "../src/modules/data-sources/infoconv/fields";
import type { ConsultationResult } from "../src/modules/consultations/models/consultation-types";

test("exportação inclui descrições sem alterar os códigos originais", () => {
  const result: ConsultationResult = {
    id: crypto.randomUUID(),
    batchId: crypto.randomUUID(),
    kind: "cpf",
    document: "11144477735",
    status: "success",
    origin: "mock",
    obtainedAt: "2026-10-23T12:00:00Z",
    data: {
      NaturezaOcupacao: "41",
      OcupacaoPrincipal: "212",
      Sexo: "2",
      ResidenteExterior: "N",
      Estrangeiro: "S",
    },
  };
  const original = JSON.stringify(result);
  const csv = exportResultsCsv([result]);
  expect(csv).toContain(
    "41 — Membro ou servidor público da administração direta municipal",
  );
  expect(csv).toContain("212 — Analista de sistemas");
  expect(csv).toContain("2 — Feminino");
  expect(csv).toContain("N — Não");
  expect(csv).toContain("S — Sim");
  expect(JSON.stringify(result)).toBe(original);
});

test("datas cadastrais usam dd/mm/aaaa sem conversão de fuso nem normalização de datas inválidas", () => {
  expect(formatField("19850312", "DataNascimento")).toBe("12/03/1985");
  expect(formatDate("2024-02-29")).toBe("29/02/2024");
  expect(formatDate("2024-02-29T00:00:00Z")).toBe("29/02/2024");
  expect(formatDate("29/02/2024")).toBe("29/02/2024");
  for (const value of [
    "00000000",
    "20230229",
    "20241301",
    "20240100",
    "20240431",
    "texto",
    "0000-00-00",
    "01/13/2020",
  ])
    expect(formatDate(value)).toBe("-");
});
test("valores ausentes e identificadores zerados recebem traço sem apagar zeros válidos", () => {
  for (const value of [
    undefined,
    "",
    "   ",
    "null",
    "00000000000",
    "000.000.000-00",
  ])
    expect(formatField(value, "CPF")).toBe("-");
  expect(formatField("00000000", "CEP")).toBe("-");
  expect(formatField("000000000", "Telefone")).toBe("-");
  expect(formatField("00", "SituacaoCadastral")).toBe("0");
  expect(formatField("0", "PercentualParticipacao")).toBe("0");
  expect(formatField("00000000", "CapitalSocial")).toBe("0,00");
  expect(formatField("000123", "CodigoMunicipio")).toBe("000123");
});
test("ano de óbito zerado não se aplica, enquanto ano ausente ou inválido não presume situação vital", () => {
  expect(formatField("0000", "AnoObito")).toBe("Não se aplica");
  expect(formatField("0", "AnoObito")).toBe("Não se aplica");
  expect(formatField("2020", "AnoObito")).toBe("2020");
  expect(formatField(undefined, "AnoObito")).toBe("-");
  expect(formatField("999999", "AnoObito")).toBe("-");
});
test("máscaras preservam documentos e CEP com zeros iniciais, inclusive CNPJ alfanumérico", () => {
  expect(formatField("11144477735", "CPF")).toBe("111.444.777-35");
  expect(formatField("04252011000110", "CNPJ")).toBe("04.252.011/0001-10");
  expect(formatField("12ABC34501DE35", "CNPJ")).toBe("12.ABC.345/01DE-35");
  expect(formatField("01001000", "CEP")).toBe("01001-000");
  expect(formatField("999991234", "Telefone")).toBe("99999-1234");
  expect(
    formatField(
      [{ Numero: "00000000000", PercentualParticipacao: "0" }],
      "Sociedade",
    ),
  ).toBe("Numero: - · PercentualParticipacao: 0");
});
test("agrupamentos mantêm todos os campos cadastrais sem duplicação", () => {
  for (const kind of ["cpf", "cnpj"] as const) {
    const fields = resultGroups(kind).flatMap((group) =>
      group.fields.map((item) => item.field),
    );
    expect(fields.length).toBe(new Set(fields).size);
    expect(fields.sort()).toEqual(
      Object.keys(kind === "cpf" ? CPF_FIELDS : CNPJ_FIELDS)
        .filter((field) => field !== "Sociedade")
        .sort(),
    );
  }
});

test("domínios CPF mostram código e descrição sem confundir os campos", () => {
  expect(formatField("41", "NaturezaOcupacao")).toBe(
    "41 — Membro ou servidor público da administração direta municipal",
  );
  expect(formatField("041", "NaturezaOcupacao")).toBe(
    "041 — Membro ou servidor público da administração direta municipal",
  );
  expect(formatField("01", "NaturezaOcupacao")).toBe(
    "01 — Empregado de empresa do setor privado, exceto de instituições financeiras",
  );
  expect(formatField("212", "OcupacaoPrincipal")).toContain(
    "212 — Analista de sistemas",
  );
  expect(formatField("010", "OcupacaoPrincipal")).toBe(
    "010 — Militar da Aeronáutica",
  );
  expect(formatField("000", "OcupacaoPrincipal")).toBe(
    "000 — Outras ocupações não especificadas anteriormente",
  );
  expect(formatField("000", "NaturezaOcupacao")).toBe("-");
  expect(formatField("1", "Sexo")).toBe("1 — Masculino");
  expect(formatField("2", "Sexo")).toBe("2 — Feminino");
  expect(formatField("9", "Sexo")).toBe("9 — Não informado");
  for (const field of ["ResidenteExterior", "Estrangeiro"]) {
    expect(formatField("S", field)).toBe("S — Sim");
    expect(formatField("N", field)).toBe("N — Não");
    expect(formatField(" n ", field)).toBe("n — Não");
    expect(formatField(undefined, field)).toBe("-");
    expect(formatField("0", field)).toBe(
      "0 — Código não identificado na tabela de referência",
    );
  }
  expect(formatField("999", "OcupacaoPrincipal")).toBe(
    "999 — Código não identificado na tabela de referência",
  );
  expect(formatField("__proto__", "Sexo")).toContain("Código não identificado");
  expect(formatField("2", "OutroCampo")).toBe("2");
});

test("ocupações preservam a validade informada pela Receita em alterações históricas", () => {
  expect(formatField("229", "OcupacaoPrincipal")).toContain(
    "até o ano-calendário 2023",
  );
  expect(formatField("230", "OcupacaoPrincipal")).toContain(
    "Fonoaudiólogo (a partir do ano-calendário 2024)",
  );
  expect(formatField("231", "OcupacaoPrincipal")).toContain(
    "Fisioterapeuta (a partir do ano-calendário 2024)",
  );
  expect(formatField("232", "OcupacaoPrincipal")).toContain(
    "Terapeuta ocupacional (a partir do ano-calendário 2024)",
  );
});
