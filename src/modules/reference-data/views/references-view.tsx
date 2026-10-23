"use client";
import { useState, type FormEvent } from "react";
import {
  exportReferenceCsv,
  parseReferenceCsv,
} from "../services/reference-service";
type ReferenceValue = { id: string; type: string; code: string; label: string };

export function ReferencesView({
  initialData,
}: {
  initialData: {
    types: { code: string; label: string }[];
    values: ReferenceValue[];
  };
}) {
  const [types, setTypes] = useState(initialData.types);
  const [values, setValues] = useState<ReferenceValue[]>(initialData.values);
  const [editing, setEditing] = useState<ReferenceValue | null>(null);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function load() {
    try {
      const response = await fetch("/api/admin/references");
      if (!response.ok) throw new Error();
      const body: { types: typeof types; values: ReferenceValue[] } =
        await response.json();
      setTypes(body.types);
      setValues(body.values);
    } catch {
      setMessage("Não foi possível carregar os domínios.");
    }
  }
  async function mutate(body: unknown) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: { message?: string } = await response.json();
      setMessage(
        response.ok
          ? "Domínios atualizados."
          : (data.message ??
              "Não foi possível salvar. Verifique se há códigos vinculados ao tipo."),
      );
      if (response.ok) {
        setEditing(null);
        await load();
      }
    } catch {
      setMessage("Serviço indisponível.");
    } finally {
      setPending(false);
    }
  }
  async function saveType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate({
      action: "save-type",
      item: { code: data.get("code"), label: data.get("label") },
    });
  }
  async function saveValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate({
      action: "save-value",
      item: {
        id: editing?.id,
        type: data.get("type"),
        code: data.get("code"),
        label: data.get("label"),
      },
    });
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 512_000 || !file.name.endsWith(".csv")) {
      setMessage("Envie CSV de até 512 KB.");
      return;
    }
    try {
      await mutate({
        action: "import",
        items: parseReferenceCsv(await file.text()),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV inválido.");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportReferenceCsv(values)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "dominios-infoconv.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Domínios e códigos</h1>
          <p>
            Tipos e descrições equivalentes às tabelas de chaves do legado. Este
            cadastro não armazena credenciais.
          </p>
        </div>
      </div>
      <div className="form-grid">
        <form className="consultation-form" onSubmit={saveType}>
          <h2>Cadastrar ou atualizar tipo</h2>
          <label htmlFor="type-code">Código do tipo</label>
          <input
            id="type-code"
            name="code"
            maxLength={40}
            pattern="[A-Z0-9_]+"
            required
            placeholder="SECRETARIA"
          />
          <label htmlFor="type-label">Descrição do tipo</label>
          <input id="type-label" name="label" maxLength={120} required />
          <button className="button" disabled={pending}>
            Salvar tipo
          </button>
        </form>
        <form
          key={editing?.id ?? "new"}
          className="consultation-form"
          onSubmit={saveValue}
        >
          <h2>{editing ? "Editar código" : "Cadastrar código"}</h2>
          <label htmlFor="reference-type">Tipo</label>
          <select
            id="reference-type"
            name="type"
            defaultValue={editing?.type}
            required
          >
            {types.map((type) => (
              <option value={type.code} key={type.code}>
                {type.label}
              </option>
            ))}
          </select>
          <label htmlFor="reference-code">Código</label>
          <input
            id="reference-code"
            name="code"
            defaultValue={editing?.code}
            maxLength={40}
            required
          />
          <label htmlFor="reference-label">Descrição</label>
          <input
            id="reference-label"
            name="label"
            defaultValue={editing?.label}
            maxLength={250}
            required
          />
          <div className="form-actions">
            <button className="button" disabled={pending}>
              Salvar código
            </button>
            {editing && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
      <p role="status">{message}</p>
      <div className="results-toolbar">
        <div>
          <label htmlFor="reference-file">
            Importar códigos CSV (type;code;label)
          </label>
          <input
            id="reference-file"
            type="file"
            accept=".csv"
            disabled={pending}
            onChange={(event) => void importFile(event.target.files?.[0])}
          />
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={download}
        >
          Exportar códigos CSV
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => window.print()}
        >
          Imprimir
        </button>
      </div>
      <label htmlFor="references-filter">
        Buscar tipo, código ou descrição
      </label>
      <input
        id="references-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              <th scope="col">Código</th>
              <th scope="col">Descrição</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {values
              .filter((value) =>
                `${value.type} ${value.code} ${value.label}`
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              )
              .slice(0, 250)
              .map((value) => (
                <tr key={value.id}>
                  <td>{value.type}</td>
                  <th scope="row">{value.code}</th>
                  <td>{value.label}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setEditing(value)}
                    >
                      Editar
                    </button>
                    {" · "}
                    <button
                      className="text-button"
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Excluir este código do cadastro de domínios?",
                          )
                        )
                          void mutate({ action: "delete-value", id: value.id });
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p>Exibindo até 250 códigos por busca.</p>
      <details>
        <summary>Tipos cadastrados</summary>
        <ul>
          {types.map((type) => (
            <li key={type.code}>
              {type.code} — {type.label}{" "}
              <button
                className="text-button"
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Excluir tipo? Tipos com códigos vinculados não podem ser removidos.",
                    )
                  )
                    void mutate({ action: "delete-type", code: type.code });
                }}
              >
                Excluir tipo
              </button>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
