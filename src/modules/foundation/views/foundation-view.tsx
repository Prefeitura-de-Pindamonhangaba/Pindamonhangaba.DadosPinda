import { LogoutButton } from "@/modules/auth/views/logout-button";

export function FoundationView({ userName }: { userName: string }) {
  return (
    <>
      <header className="institutional-header">
        <div className="container header-content">
          <strong>Prefeitura de Pindamonhangaba</strong>
          <span>SETIP · Departamento de Sistemas de Informação</span>
        </div>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        <div className="product-heading">
          <span className="eyebrow">Plataforma institucional</span>
          <div className="session-controls">
            <span>{userName}</span>
            <LogoutButton />
          </div>
        </div>
        <h1>
          Pinda Dados<span aria-hidden="true">.</span>
        </h1>
        <p className="introduction">
          Informação integrada para uma gestão municipal mais eficiente.
        </p>
        <section className="workspace" aria-labelledby="workspace-title">
          <div>
            <span className="eyebrow">01 / Fundação</span>
            <h2 id="workspace-title">Uma base para conectar dados oficiais</h2>
          </div>
          <div>
            <p>
              Ambiente inicial da plataforma de consulta cadastral da
              Prefeitura. O acesso às informações será restrito a servidores
              autorizados e vinculado a uma finalidade administrativa.
            </p>
            <p className="notice">
              Você está na área interna. As consultas ainda não estão
              disponíveis. A integração Infoconv será configurada na próxima
              etapa.
            </p>
          </div>
        </section>
        <section aria-labelledby="sources-title">
          <h2 id="sources-title">Fontes de dados</h2>
          <div className="table-container">
            <table>
              <caption className="visually-hidden">
                Situação da primeira fonte prevista
              </caption>
              <thead>
                <tr>
                  <th scope="col">Fonte</th>
                  <th scope="col">Abrangência prevista</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Infoconv · SERPRO</th>
                  <td>CPF e CNPJ, conforme contratação</td>
                  <td>Aguardando configuração</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <aside className="privacy">
          <h2>Uso responsável da informação</h2>
          <p>
            Controle de acesso, privacidade e rastreabilidade orientarão todas
            as consultas. Esta etapa não realiza consultas nem armazena dados
            cadastrais.
          </p>
        </aside>
      </main>
      <footer className="container">
        Pinda Dados · Prefeitura Municipal de Pindamonhangaba
      </footer>
    </>
  );
}
