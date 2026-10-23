"use client";
import { SOCIETY_FIELDS } from "@/modules/data-sources/infoconv/fields";
import { resultGroups } from "../services/result-groups";
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
              {result.kind.toUpperCase()}{" "}
              {formatField(result.document, result.kind.toUpperCase())}
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
              <div className="result-sections">
                {resultGroups(result.kind).map((group) => (
                  <section
                    className="result-section"
                    key={group.title}
                    aria-label={group.title}
                  >
                    <h4>{group.title}</h4>
                    <dl className="result-fields">
                      {group.fields.map(({ field, label }) => (
                        <div className="result-field" key={field}>
                          <dt>{label}</dt>
                          <dd>{formatField(result.data[field], field)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
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
                                    ? formatField(partner[field], field)
                                    : formatField(partner, field)}
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
