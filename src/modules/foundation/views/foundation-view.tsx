import Link from "next/link";
import { PanelShell } from "@/shared/components/panel-shell";

export function FoundationView({
  userName,
  admin,
  canConsult,
}: {
  userName: string;
  admin: boolean;
  canConsult: boolean;
}) {
  return (
    <PanelShell userName={userName} admin={admin} canConsult={canConsult}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Plataforma institucional</span>
          <h1>Informação para a gestão municipal</h1>
          <p>
            Consulta e integração de dados oficiais, com finalidade
            administrativa e acesso auditado.
          </p>
        </div>
      </div>
      <section className="workspace">
        <div>
          <span className="eyebrow">Fonte oficial · Receita Federal</span>
          <h2>Infoconv · SERPRO</h2>
          <p>
            Consultas de pessoas físicas e jurídicas nos perfis utilizados pela
            Prefeitura.
          </p>
          {canConsult ? (
            <Link className="button" href="/consultations">
              Consultar CPF ou CNPJ
            </Link>
          ) : (
            <p className="notice">
              Seu perfil permite acesso ao painel. Solicite ao administrador a
              permissão de consulta cadastral.
            </p>
          )}
        </div>
        <div>
          <h2>Reutilização segura dos dados</h2>
          <p>
            Antes de solicitar novos dados ao SERPRO, o sistema procura uma
            resposta válida na base local. As respostas ficam criptografadas por
            até 7 dias.
          </p>
          <p>
            Consultas individuais e lotes têm identificação da origem, data de
            obtenção e finalidade registrada em auditoria.
          </p>
        </div>
      </section>
      <aside className="privacy">
        <h2>Uso responsável da informação</h2>
        <p>
          Utilize os dados somente para a finalidade administrativa declarada. O
          acesso técnico ao sistema não autoriza consultas irrestritas.
          Exportações e documentos impressos devem seguir os mesmos cuidados de
          proteção.
        </p>
      </aside>
    </PanelShell>
  );
}
