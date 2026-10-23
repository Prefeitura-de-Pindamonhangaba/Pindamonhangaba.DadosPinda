"use client";
import { useRef, useState, type FormEvent } from "react";
import type { Permission } from "@/modules/auth/permissions";
import { parseDocumentList } from "../schemas/consultation-schema";
import type {
  ConsultationResult,
  DocumentKind,
} from "../models/consultation-types";
import { ResultsTable } from "./results-table";

function waitForQuota(signal: AbortSignal) {
  if (signal.aborted)
    return Promise.reject(new DOMException("Interrompido", "AbortError"));
  return new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("Interrompido", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, 60_000);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export function ConsultationView({
  permissions,
}: {
  permissions: Permission[];
}) {
  const [kind, setKind] = useState<DocumentKind>(
    permissions.includes("consultations:cpf") ? "cpf" : "cnpj",
  );
  const [mode, setMode] = useState("single");
  const [documents, setDocuments] = useState("");
  const [purpose, setPurpose] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [results, setResults] = useState<ConsultationResult[]>([]);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const controller = useRef<AbortController | null>(null);

  async function readFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt") || file.size > 64_000) {
      setMessage(
        "Envie um arquivo TXT de até 64 KB, com um documento por linha.",
      );
      return;
    }
    setDocuments(await file.text());
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    let list: string[];
    try {
      list = parseDocumentList(kind, documents);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Documentos inválidos.",
      );
      return;
    }
    if (purpose.trim().length < 10) {
      setMessage(
        "Descreva a finalidade administrativa com pelo menos 10 caracteres.",
      );
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    const batchId = crypto.randomUUID();
    setPending(true);
    setResults([]);
    setProgress({ done: 0, total: list.length });
    let consecutiveFailures = 0;
    try {
      for (let index = 0; index < list.length; index++) {
        if (abort.signal.aborted) break;
        const response = await fetch("/api/consultations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            document: list[index],
            purpose,
            forceRefresh,
            batchId,
            batch: mode === "batch",
          }),
          signal: abort.signal,
        });
        if (!response.ok) {
          const body: { message?: string; code?: string } =
            await response.json();
          if (
            mode === "batch" &&
            response.status === 429 &&
            body.code === "rate_limit"
          ) {
            setMessage(
              "Limite por minuto atingido. O lote continuará em 60 segundos; você pode interrompê-lo a qualquer momento.",
            );
            await waitForQuota(abort.signal);
            setMessage("");
            index--;
            continue;
          }
          setMessage(body.message ?? "Não foi possível concluir a consulta.");
          break;
        }
        const result: ConsultationResult = await response.json();
        setResults((current) => [...current, result]);
        setProgress({ done: index + 1, total: list.length });
        consecutiveFailures =
          result.status === "unavailable" ? consecutiveFailures + 1 : 0;
        if (consecutiveFailures >= 3) {
          setMessage(
            "Lote interrompido após três falhas consecutivas na fonte. Os resultados já obtidos foram preservados.",
          );
          break;
        }
      }
    } catch {
      if (!abort.signal.aborted)
        setMessage(
          "Não foi possível comunicar com o servidor. Resultados já obtidos foram preservados nesta tela.",
        );
      else
        setMessage(
          "Lote interrompido. Resultados já obtidos estão disponíveis abaixo.",
        );
    } finally {
      setPending(false);
      controller.current = null;
    }
  }

  async function disclose(format: "csv" | "print") {
    setMessage("");
    try {
      const response = await fetch("/api/consultations/disclose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results, format }),
      });
      if (!response.ok) {
        const body: { message?: string } = await response.json();
        setMessage(body.message ?? "Exportação não autorizada.");
        return;
      }
      if (format === "print") {
        window.print();
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `infoconv-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Não foi possível exportar os resultados.");
    }
  }
  const filtered = results.filter((result) =>
    `${result.document} ${JSON.stringify(result.data)}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Infoconv · SERPRO</span>
          <h1>Consultas cadastrais</h1>
          <p>
            Consulte primeiro a base local. Novos dados são obtidos na fonte
            oficial quando necessário.
          </p>
        </div>
        <span className="status">Cache criptografado · 7 dias</span>
      </div>
      <form className="consultation-form" onSubmit={submit}>
        <fieldset disabled={pending}>
          <legend>Identificação da consulta</legend>
          <div className="form-grid">
            <div>
              <label htmlFor="kind">Tipo de documento</label>
              <select
                id="kind"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as DocumentKind);
                  setDocuments("");
                }}
              >
                {permissions.includes("consultations:cpf") && (
                  <option value="cpf">CPF · Pessoa física</option>
                )}
                {permissions.includes("consultations:cnpj") && (
                  <option value="cnpj">CNPJ · Pessoa jurídica</option>
                )}
              </select>
            </div>
            <div>
              <label htmlFor="mode">Modalidade</label>
              <select
                id="mode"
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value);
                  setDocuments("");
                }}
              >
                <option value="single">Consulta individual</option>
                {permissions.includes("consultations:batch") && (
                  <option value="batch">Lote por texto ou arquivo TXT</option>
                )}
              </select>
            </div>
          </div>
          {mode === "single" ? (
            <>
              <label htmlFor="document">{kind.toUpperCase()}</label>
              <input
                key="single-document"
                id="document"
                autoComplete="off"
                value={documents}
                maxLength={24}
                onChange={(event) => setDocuments(event.target.value)}
                required
              />
            </>
          ) : (
            <>
              <label htmlFor="file">Importar arquivo TXT</label>
              <input
                key="batch-file"
                id="file"
                type="file"
                accept=".txt,text/plain"
                onChange={(event) => void readFile(event.target.files?.[0])}
              />
              <label htmlFor="documents">Documentos, um por linha</label>
              <textarea
                id="documents"
                value={documents}
                onChange={(event) => setDocuments(event.target.value)}
                rows={6}
                maxLength={64_000}
                required
              />
              <small>
                Até 500 documentos. Duplicados são consultados uma única vez por
                lote.
              </small>
            </>
          )}
          <label htmlFor="purpose">Finalidade administrativa</label>
          <textarea
            id="purpose"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            minLength={10}
            maxLength={500}
            rows={2}
            placeholder="Informe o processo, atividade ou procedimento que justifica esta consulta."
            required
          />
          {permissions.includes("consultations:refresh") && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(event) => setForceRefresh(event.target.checked)}
              />
              Atualizar diretamente no SERPRO, mesmo se houver cache válido
              (consome cota).
            </label>
          )}
        </fieldset>
        <div className="form-actions">
          <button className="button" disabled={pending} type="submit">
            {pending ? "Consultando…" : "Consultar"}
          </button>
          {pending && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => controller.current?.abort()}
            >
              Interromper lote
            </button>
          )}
        </div>
      </form>
      <div aria-live="polite">
        {progress.total > 0 && (
          <p>
            {progress.done} de {progress.total} documento(s) processado(s).
          </p>
        )}
        {pending && (
          <progress
            max={progress.total}
            value={progress.done}
            aria-label="Progresso do lote"
          />
        )}
      </div>
      <p className="form-error" role="alert">
        {message}
      </p>
      {results.length > 0 && (
        <section aria-labelledby="results-title">
          <div className="results-toolbar">
            <h2 id="results-title">Resultados</h2>
            <div>
              {permissions.includes("consultations:export") && (
                <>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => void disclose("csv")}
                  >
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => void disclose("print")}
                  >
                    Imprimir / Salvar PDF
                  </button>
                </>
              )}
            </div>
          </div>
          <label htmlFor="filter">Filtrar resultados desta tela</label>
          <input
            id="filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <p>
            {results.filter((row) => row.origin === "cache").length}{" "}
            reutilizado(s) da base local ·{" "}
            {results.filter((row) => row.origin === "serpro").length}{" "}
            tentativa(s) de consulta à fonte.
          </p>
          <ResultsTable results={filtered} />
        </section>
      )}
    </>
  );
}
