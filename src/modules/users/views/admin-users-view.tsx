"use client";
import { useState, type FormEvent } from "react";
import type { Role } from "@/modules/auth/permissions";
import { parseCsv } from "@/shared/lib/csv";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  enabled: boolean;
  createdAt: string;
};
const roleLabels = {
  viewer: "Visualizador",
  operator: "Operador de consultas",
  admin: "Administrador",
};

export function AdminUsersView({
  initialUsers,
}: {
  initialUsers: ManagedUser[];
}) {
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function load() {
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) throw new Error();
      const body: { users: ManagedUser[] } = await response.json();
      setUsers(body.users);
    } catch {
      setMessage("Não foi possível carregar os servidores.");
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (!file.name.endsWith(".csv") || file.size > 100_000) {
      setMessage("Envie CSV de até 100 KB, com até 100 servidores.");
      return;
    }
    setPending(true);
    try {
      const rows = parseCsv(await file.text());
      if (rows[0]?.join(";") !== "name;email;role")
        throw new Error("Use o cabeçalho name;email;role.");
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          items: rows
            .slice(1)
            .map(([name, email, role]) => ({ name, email, role })),
        }),
      });
      const data: { message?: string } = await response.json();
      setMessage(data.message ?? "Não foi possível importar.");
      if (response.ok) await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível importar.",
      );
    } finally {
      setPending(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      id: editing?.id,
      name: data.get("name"),
      email: data.get("email"),
      role: data.get("role"),
      enabled: data.get("enabled") === "on",
    };
    try {
      const response = await fetch("/api/admin/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result: { message?: string } = await response.json();
      setMessage(
        result.message ??
          (response.ok
            ? "Servidor cadastrado."
            : "Não foi possível cadastrar. Verifique se o e-mail já existe."),
      );
      if (response.ok) {
        setEditing(null);
        form.reset();
        await load();
      }
    } catch {
      setMessage("Serviço indisponível.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Servidores e acessos</h1>
          <p>
            Contas individuais, papéis e revogação de sessões. O login utiliza o
            Keycloak institucional.
          </p>
        </div>
      </div>
      <form
        className="consultation-form"
        onSubmit={submit}
        key={editing?.id ?? "new"}
      >
        <h2>{editing ? "Editar servidor" : "Cadastrar servidor"}</h2>
        <fieldset disabled={pending}>
          <div className="form-grid">
            <div>
              <label htmlFor="user-name">Nome</label>
              <input
                id="user-name"
                name="name"
                defaultValue={editing?.name}
                minLength={2}
                maxLength={120}
                required
              />
            </div>
            <div>
              <label htmlFor="user-email">E-mail</label>
              <input
                id="user-email"
                type="email"
                name="email"
                defaultValue={editing?.email}
                required
              />
            </div>
            <div>
              <label htmlFor="user-role">Papel</label>
              <select
                id="user-role"
                name="role"
                defaultValue={editing?.role ?? "viewer"}
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {editing && (
            <label className="checkbox-label">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={editing.enabled}
              />
              Conta ativa
            </label>
          )}
        </fieldset>
        <div className="form-actions">
          <button className="button" disabled={pending}>
            {pending ? "Salvando…" : "Salvar servidor"}
          </button>
          {editing && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setEditing(null)}
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>
      <p role="status">{message}</p>
      <div className="results-toolbar">
        <div>
          <label htmlFor="users-file">
            Importar servidores CSV (name;email;role)
          </label>
          <input
            id="users-file"
            type="file"
            accept=".csv"
            disabled={pending}
            onChange={(event) => void importFile(event.target.files?.[0])}
          />
        </div>
        <a
          className="button button-secondary"
          href="/api/admin/users?format=csv"
        >
          Exportar servidores CSV
        </a>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => window.print()}
        >
          Imprimir
        </button>
      </div>
      <p>
        Contas importadas começam desativadas. Vincule cada conta ao Keycloak
        antes de ativá-la.
      </p>
      <label htmlFor="users-filter">Buscar servidor</label>
      <input
        id="users-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Papel</th>
              <th scope="col">Situação</th>
              <th scope="col">Ação</th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter((item) =>
                `${item.name} ${item.email}`
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              )
              .map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.name}</th>
                  <td>{item.email}</td>
                  <td>{roleLabels[item.role]}</td>
                  <td>{item.enabled ? "Ativo" : "Desativado"}</td>
                  <td>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setEditing(item)}
                    >
                      Editar {item.name}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="notice">
        Visualizadores não consultam dados cadastrais. Operadores consultam e
        exportam. Administradores também gerenciam acessos, domínios e
        atualização forçada no SERPRO.
      </p>
    </>
  );
}
