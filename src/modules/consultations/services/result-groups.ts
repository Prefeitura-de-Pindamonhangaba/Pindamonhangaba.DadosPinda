import {
  CPF_FIELDS,
  CNPJ_FIELDS,
} from "@/modules/data-sources/infoconv/fields";
import type { DocumentKind } from "../models/consultation-types";

const groups = [
  {
    title: "Identificação",
    fields: [
      "CPF",
      "CNPJ",
      "Nome",
      "NomeEmpresarial",
      "NomeFantasia",
      "NomeMae",
      "DataNascimento",
      "Sexo",
      "AnoObito",
      "Estabelecimento",
    ],
  },
  {
    title: "Cadastro e atividade",
    fields: [
      "SituacaoCadastral",
      "MotivoSituacao",
      "DataSituacaoCadastral",
      "DataInscricao",
      "DataAtualizacao",
      "DataAbertura",
      "NaturezaJuridica",
      "NaturezaOcupacao",
      "OcupacaoPrincipal",
      "ExercicioOcupacao",
      "CNAEPrincipal",
      "CNAESecundario",
      "Porte",
      "CapitalSocial",
      "OpcaoSimples",
      "OpcaoSIMEI",
      "SituacaoEspecial",
      "DataSituacaoEspecial",
    ],
  },
  {
    title: "Endereço",
    fields: [
      "TipoLogradouro",
      "Logradouro",
      "NumeroLogradouro",
      "Complemento",
      "Bairro",
      "CEP",
      "UF",
      "CodigoMunicipio",
      "Municipio",
      "NomeMunicipio",
      "Referencia",
      "CidadeExterior",
    ],
  },
  {
    title: "Contato e responsável",
    fields: [
      "DDD",
      "Telefone",
      "DDD1",
      "Telefone1",
      "DDD2",
      "Telefone2",
      "Email",
      "CPFResponsavel",
      "NomeResponsavel",
    ],
  },
  {
    title: "Origem e informações complementares",
    fields: [
      "ResidenteExterior",
      "CodigoPaisExterior",
      "NomePaisExterior",
      "Estrangeiro",
      "CodPaisNacionalidade",
      "NomePaisNacionalidade",
      "CodigoMunicipioNaturalidade",
      "NomeMunicipioNaturalidade",
      "UFMunicipioNaturalidade",
      "CodigoPais",
      "NomePais",
      "UnidadeAdministrativa",
    ],
  },
];
export function resultGroups(kind: DocumentKind) {
  const catalog: Record<string, string> =
    kind === "cpf" ? CPF_FIELDS : CNPJ_FIELDS;
  return groups
    .map((group) => ({
      title: group.title,
      fields: group.fields
        .filter((field) => Object.hasOwn(catalog, field))
        .map((field) => ({ field, label: catalog[field] })),
    }))
    .filter((group) => group.fields.length > 0);
}
