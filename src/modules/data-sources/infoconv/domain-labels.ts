import occupations from "./occupation-domains.json";

// Fontes e validade das tabelas: docs/infoconv.md, seção Domínios cadastrais.
const domains: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  NaturezaOcupacao: occupations.occupationNature,
  OcupacaoPrincipal: occupations.principalOccupation,
  Sexo: { "1": "Masculino", "2": "Feminino", "9": "Não informado" },
  ResidenteExterior: { S: "Sim", N: "Não" },
  Estrangeiro: { S: "Sim", N: "Não" },
};

export function describeInfoconvCode(
  field: string,
  value: string,
): string | undefined {
  if (!Object.hasOwn(domains, field)) return undefined;
  const raw = value.trim();
  if (!raw) return "-";
  if (/^0{2,}$/.test(raw) && (field !== "OcupacaoPrincipal" || raw.length > 3))
    return "-";
  let code = raw.toUpperCase();
  if (field === "NaturezaOcupacao" && /^\d{1,3}$/.test(code))
    code = String(Number(code)).padStart(2, "0");
  if (field === "OcupacaoPrincipal" && /^\d{1,3}$/.test(code))
    code = code.padStart(3, "0");
  const dictionary = domains[field];
  const description = Object.hasOwn(dictionary, code)
    ? dictionary[code]
    : undefined;
  return description
    ? `${raw} — ${description}`
    : `${raw} — Código não identificado na tabela de referência`;
}
