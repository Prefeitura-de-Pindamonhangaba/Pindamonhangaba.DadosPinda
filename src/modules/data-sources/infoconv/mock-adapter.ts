import {
  ConsultationError,
  type DataSourceAdapter,
  type DocumentKind,
  type ProfileData,
} from "@/modules/consultations/models/consultation-types";

// A composição só permite este adapter em testes locais, nunca em produção.
export class MockInfoconvAdapter implements DataSourceAdapter {
  readonly isMock = true;
  async consult(
    kind: DocumentKind,
    document: string,
  ): Promise<{ mock: boolean; data: ProfileData }> {
    if (document === "52998224725") throw new ConsultationError("not_found");
    return {
      mock: true,
      data:
        kind === "cpf"
          ? {
              CPF: document,
              Nome: "PESSOA FICTÍCIA — TESTE",
              SituacaoCadastral: "0",
              Municipio: "MUNICÍPIO FICTÍCIO",
              NomeMae: "MÃE FICTÍCIA",
            }
          : {
              CNPJ: document,
              NomeEmpresarial: "EMPRESA FICTÍCIA — TESTE",
              NomeFantasia: "DADOS FICTÍCIOS",
              NomeMunicipio: "MUNICÍPIO FICTÍCIO",
              CNAESecundario: ["0000000"],
              Sociedade: [
                { Nome: "SÓCIO FICTÍCIO", Tipo: "2", Numero: "00000000000" },
              ],
            },
    };
  }
}
