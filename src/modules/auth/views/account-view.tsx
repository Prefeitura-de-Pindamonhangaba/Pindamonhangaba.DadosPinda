"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "@/shared/lib/auth/client";

export function AccountView() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== data.get("confirmPassword")) {
      setMessage("As senhas não conferem.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error)
        setMessage(
          "Não foi possível alterar a senha. Verifique a senha atual e tente novamente.",
        );
      else {
        setMessage("Senha alterada. As demais sessões foram encerradas.");
        form.reset();
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
          <span className="eyebrow">Conta individual</span>
          <h1>Alterar senha</h1>
          <p>Informe a senha atual para definir uma nova senha de acesso.</p>
        </div>
      </div>
      <form className="consultation-form narrow-form" onSubmit={submit}>
        <fieldset disabled={pending}>
          <label htmlFor="current-password">Senha atual</label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
          <label htmlFor="new-password">Nova senha</label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
          <label htmlFor="confirm-password">Repita a nova senha</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </fieldset>
        <button className="button" disabled={pending}>
          {pending ? "Salvando…" : "Alterar senha"}
        </button>
        <p role="status">{message}</p>
      </form>
    </>
  );
}
