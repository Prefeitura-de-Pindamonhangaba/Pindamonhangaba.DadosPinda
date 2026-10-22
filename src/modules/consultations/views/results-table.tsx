"use client";
import {
  CPF_FIELDS,
  CNPJ_FIELDS,
  SOCIETY_FIELDS,
} from "@/modules/data-sources/infoconv/fields";
import type { ConsultationResult } from "../models/consultation-types";
import {
  formatField,
  originLabels,
  statusLabels,
} from "../services/result-format";

export function ResultsTable({ results }: { results: ConsultationResult[] }) {
  return (
    <div className="results-list">
      {results.map((result) => (
        <article className="result-record" key={result.id}>
          <div className="result-heading">
            <h3>
              {result.kind.toUpperCase()} {result.document}
            </h3>
            <span className="status">{statusLabels[result.status]}</span>
          </div>
          <p className="result-origin">
            {originLabels[result.origin]} · Obtido em{" "}
            {new Date(result.obtainedAt).toLocaleString("pt-BR")}
            {result.expiresAt &&
              ` · Cache válido até ${new Date(result.expiresAt).toLocaleString("pt-BR")}`}
          </p>
          {result.message && (
            <p role="status" className="notice">
              {result.message}
            </p>
          )}
          {result.status === "success" && (
            <details open>
              <summary>Dados cadastrais</summary>
              <div className="table-container">
                <table>
                  <caption className="visually-hidden">
                    Dados retornados pelo Infoconv para {result.document}
                  </caption>
                  <tbody>
                    {Object.entries(
                      result.kind === "cpf" ? CPF_FIELDS : CNPJ_FIELDS,
                    )
                      .filter(([field]) => field !== "Sociedade")
                      .map(([field, label]) => (
                        <tr key={field}>
                          <th scope="row">{label}</th>
                          <td>{formatField(result.data[field])}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {Array.isArray(result.data.Sociedade) &&
                result.data.Sociedade.length > 0 && (
                  <>
                    <h4>Quadro societário</h4>
                    <div className="table-container">
                      <table className="society-table">
                        <caption className="visually-hidden">
                          Quadro societário retornado pelo Infoconv
                        </caption>
                        <thead>
                          <tr>
                            {Object.entries(SOCIETY_FIELDS).map(
                              ([key, label]) => (
                                <th scope="col" key={key}>
                                  {label}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.Sociedade.map((partner, index) => (
                            <tr key={index}>
                              {Object.keys(SOCIETY_FIELDS).map((field) => (
                                <td key={field}>
                                  {typeof partner === "object"
                                    ? partner[field] || "Não informado"
                                    : partner}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              {result.kind === "cnpj" && (
                <a
                  className="external-link"
                  href={`https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/Cnpjreva_Solicitacao.asp?cnpj=${encodeURIComponent(result.document)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  Abrir comprovante na Receita Federal ↗
                </a>
              )}
            </details>
          )}
          <p className="correlation">
            Correlação: {result.id} · Lote: {result.batchId}
          </p>
        </article>
      ))}
    </div>
  );
}
