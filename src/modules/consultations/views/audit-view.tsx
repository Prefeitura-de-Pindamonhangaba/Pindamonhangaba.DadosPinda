"use client";
import { useEffect, useState } from "react";

type AuditRow = {
  id: string;
  userId: string;
  batchId: string;
  kind: string;
  documentMasked: string;
  purpose: string;
  status: string;
  origin: string;
  createdAt: string;
};
const labels: Record<string, string> = {
  pending: "Em processamento",
  success: "Concluída",
  mock: "Dados fictícios",
  unavailable: "Indisponível",
  not_found: "Sem resultado",
  cache: "Base local",
  serpro: "SERPRO",
};

export function AuditView() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [usage, setUsage] = useState<
    { kind: string; origin: string; count: number }[]
  >([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("Carregando registros…");
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/consultations/audit", { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data: { records: AuditRow[]; usage: typeof usage } =
          await response.json();
        setRows(data.records);
        setUsage(data.usage);
        setMessage(data.records.length ? "" : "Nenhuma consulta registrada.");
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setMessage("Não foi possível carregar a auditoria.");
      });
    return () => abort.abort();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Rastreabilidade</span>
          <h1>Auditoria de consultas</h1>
          <p>
            Últimos 250 registros autorizados. As respostas cadastrais não fazem
            parte da auditoria.
          </p>
        </div>
      </div>
      {usage.length > 0 && (
        <section className="usage-summary">
          <h2>Uso no mês atual · UTC</h2>
          <p>
            Contagem desta aplicação; não representa o extrato de faturamento do
            SERPRO.
          </p>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th scope="col">Tipo</th>
                  <th scope="col">Origem</th>
                  <th scope="col">Operações</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row) => (
                  <tr key={`${row.kind}-${row.origin}`}>
                    <td>{row.kind.toUpperCase()}</td>
                    <td>{labels[row.origin] ?? row.origin}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <label htmlFor="audit-filter">
        Buscar por finalidade, documento protegido ou correlação
      </label>
      <input
        id="audit-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <p role="status">{message}</p>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th scope="col">Data e hora</th>
              <th scope="col">Documento protegido</th>
              <th scope="col">Finalidade</th>
              <th scope="col">Origem</th>
              <th scope="col">Resultado</th>
              <th scope="col">Correlação / usuário</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((row) =>
                `${row.purpose} ${row.documentMasked} ${row.id} ${row.batchId}`
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              )
              .map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString("pt-BR")}</td>
                  <th scope="row">
                    {row.kind.toUpperCase()} {row.documentMasked}
                  </th>
                  <td>{row.purpose}</td>
                  <td>{labels[row.origin] ?? row.origin}</td>
                  <td>{labels[row.status] ?? row.status}</td>
                  <td className="correlation">
                    {row.id}
                    <br />
                    Usuário: {row.userId}
                    <br />
                    Lote: {row.batchId}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
