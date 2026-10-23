"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/shared/lib/auth/client";
import { useHydrated } from "@/shared/lib/auth/use-hydrated";
import { loginSchema } from "@/modules/auth/schemas/login-schema";
import {
  InstitutionalHeader,
  InstitutionalFooter,
} from "@/shared/components/institutional-header";

export function LoginView() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setError("Informe e-mail e senha válidos.");
      return;
    }
    setPending(true);
    try {
      const result = await authClient.signIn.email({
        ...parsed.data,
        rememberMe: false,
      });
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Muitas tentativas. Aguarde um minuto e tente novamente."
            : result.error.status >= 500
              ? "Serviço indisponível. Tente novamente em instantes."
              : "E-mail ou senha inválidos, ou acesso não autorizado.",
        );
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Serviço indisponível. Tente novamente em instantes.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <InstitutionalHeader />
      <main id="main" className="container login-layout" tabIndex={-1}>
        <div className="login-introduction">
          <span className="eyebrow">Acesso institucional</span>
          <h1>
            Pinda Dados<span aria-hidden="true">.</span>
          </h1>
          <p className="introduction">
            Informação integrada para a gestão municipal.
          </p>
          <p>
            Acesso exclusivo a servidores autorizados. Utilize sua conta
            individual para entrar.
          </p>
        </div>
        <section className="login-panel" aria-labelledby="login-title">
          <h2 id="login-title">Entrar no sistema</h2>
          <p>Informe suas credenciais de acesso.</p>
          <form onSubmit={handleSubmit} aria-busy={pending}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
              disabled={pending}
            />
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
              disabled={pending}
            />
            <p className="form-error" role="alert" aria-live="polite">
              {error}
            </p>
            <button
              className="button"
              type="submit"
              disabled={pending || !hydrated}
            >
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>
          <p className="login-help">
            Para solicitar acesso ou recuperar sua senha, entre em contato com o
            DSI.
          </p>
        </section>
      </main>
      <InstitutionalFooter />
    </>
  );
}
