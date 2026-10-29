"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/shared/lib/auth/client";
import { useHydrated } from "@/shared/lib/auth/use-hydrated";
import {
  InstitutionalHeader,
  InstitutionalFooter,
} from "@/shared/components/institutional-header";

export function LoginView({
  keycloakEnabled = false,
}: {
  keycloakEnabled?: boolean;
}) {
  const search = useSearchParams();
  const ssoError = search.get("sso") === "error" || search.has("error");
  const hydrated = useHydrated();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signInWithKeycloak() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "keycloak",
        callbackURL: "/",
        errorCallbackURL: "/login?sso=error",
      });
      if (result.error) throw new Error("sso");
    } catch {
      setError(
        "Não foi possível entrar com a conta institucional. Tente novamente ou entre em contato com o DSI.",
      );
      setPending(false);
    }
  }

  return (
    <>
      <InstitutionalHeader />
      <main id="main" className="container welcome-layout" tabIndex={-1}>
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <span className="eyebrow">Dados a serviço da cidade</span>
          <h1 id="welcome-title">
            Pinda Dados<span aria-hidden="true">.</span>
          </h1>
          <p className="introduction">
            Informação integrada para a gestão municipal.
          </p>
          <p className="welcome-description">
            Uma plataforma para consultar informações cadastrais de pessoas e
            empresas, apoiar decisões e simplificar o trabalho dos servidores.
          </p>
          <div className="welcome-access" aria-busy={pending}>
            <button
              className="button"
              type="button"
              onClick={signInWithKeycloak}
              disabled={pending || !hydrated || !keycloakEnabled}
            >
              {pending ? "Redirecionando…" : "Login"}
            </button>
            <p>Entre com sua conta institucional da Prefeitura.</p>
          </div>
          {(error || ssoError || !keycloakEnabled) && (
            <p className="welcome-alert" role="alert">
              {error ||
                (!keycloakEnabled
                  ? "O acesso institucional está indisponível. Entre em contato com o DSI."
                  : search.get("error") === "unable_to_get_user_info"
                    ? "Acesso institucional não autorizado. Solicite ao DSI a conferência dos papéis e da configuração do cliente no Keycloak."
                    : "Acesso institucional não autorizado ou indisponível. Entre em contato com o DSI.")}
            </p>
          )}
        </section>
        <aside className="welcome-details" aria-label="Sobre a plataforma">
          <div>
            <span className="eyebrow">01 · Integração</span>
            <h2>Uma visão mais completa</h2>
            <p>
              Informações de fontes oficiais reunidas em um único ambiente de
              consulta.
            </p>
          </div>
          <div>
            <span className="eyebrow">02 · Segurança</span>
            <h2>Acesso responsável</h2>
            <p>
              Contas individuais, permissões por função e consultas registradas
              para auditoria.
            </p>
          </div>
          <p className="welcome-notice">
            Uso exclusivo de servidores autorizados, para finalidades
            administrativas. Para solicitar acesso, entre em contato com o DSI.
          </p>
        </aside>
      </main>
      <InstitutionalFooter />
    </>
  );
}
