"use client";
import { useEffect, useState, type FormEvent } from "react";
type Quota = {
  month: string;
  included: number;
  additional: number;
  history: {
    id: string;
    additional: number;
    reason: string;
    actorId: string;
    createdAt: string;
  }[];
};
export function QuotaView() {
  const [quota, setQuota] = useState<Quota>();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/consultations/quota", { signal: abort.signal })
      .then(async (response) => {
        if (response.status === 403) return;
        if (!response.ok) throw new Error();
        setQuota(await response.json());
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setMessage("Não foi possível carregar a franquia mensal.");
      });
    return () => abort.abort();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quota) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/consultations/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: quota.month,
          additional: Number(data.get("additional")),
          reason: data.get("reason"),
          acknowledgeAdditionalCharge: data.get("acknowledge") === "on",
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      setQuota(await response.json());
      form.reset();
      setMessage("Liberação mensal atualizada e registrada na auditoria.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível liberar o excedente.",
      );
    } finally {
      setPending(false);
    }
  }
  if (!quota) return message ? <p role="status">{message}</p> : null;
  return (
    <section className="usage-summary" aria-labelledby="quota-title">
      <h2 id="quota-title">
        Franquia e liberação de excedente · {quota.month} UTC
      </h2>
      <p>
        Franquia conjunta CPF/CNPJ: {quota.included.toLocaleString("pt-BR")}{" "}
        consultas. Excedente autorizado:{" "}
        {quota.additional.toLocaleString("pt-BR")}. Teto deste mês:{" "}
        {(quota.included + quota.additional).toLocaleString("pt-BR")}.
      </p>
      <p>
        Acima da franquia há cobrança adicional. O sistema bloqueia novas
        chamadas ao SERPRO no teto autorizado; dados válidos na base local
        continuam disponíveis. A liberação vale somente para este mês e não é
        renovada automaticamente.
      </p>
      <form onSubmit={submit} aria-busy={pending}>
        <label htmlFor="quota-additional">
          Total de consultas extras autorizado no mês
        </label>
        <input
          id="quota-additional"
          name="additional"
          type="number"
          min="0"
          max="1000000"
          step="1"
          defaultValue={quota.additional}
          required
          disabled={pending}
        />
        <p>
          Informe o total extra, não um incremento. Use zero para bloquear novas
          consultas acima da franquia.
        </p>
        <label htmlFor="quota-reason">
          Justificativa da liberação ou revogação
        </label>
        <input
          id="quota-reason"
          name="reason"
          minLength={10}
          maxLength={500}
          required
          disabled={pending}
        />
        <label>
          <input
            name="acknowledge"
            type="checkbox"
            required
            disabled={pending}
          />{" "}
          Estou ciente da cobrança adicional e autorizo o teto informado para
          este mês.
        </label>
        <button type="submit" className="button" disabled={pending}>
          Registrar liberação mensal
        </button>
      </form>
      <p role="status">{message}</p>
      {quota.history.length > 0 && (
        <details>
          <summary>Histórico de liberações deste mês</summary>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Extras autorizadas</th>
                  <th>Justificativa</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {quota.history.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                    <td>{item.additional}</td>
                    <td>{item.reason}</td>
                    <td>{item.actorId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
