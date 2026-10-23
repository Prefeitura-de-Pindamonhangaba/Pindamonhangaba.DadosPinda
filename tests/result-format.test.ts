import { expect, test } from "bun:test";
import {
  formatField,
  formatDate,
} from "../src/modules/consultations/services/result-format";
import { resultGroups } from "../src/modules/consultations/services/result-groups";
import {
  CPF_FIELDS,
  CNPJ_FIELDS,
} from "../src/modules/data-sources/infoconv/fields";

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
