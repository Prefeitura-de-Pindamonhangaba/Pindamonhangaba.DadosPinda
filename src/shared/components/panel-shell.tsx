import Link from "next/link";
import { LogoutButton } from "@/modules/auth/views/logout-button";

export function PanelShell({
  userName,
  children,
  admin = false,
  canConsult = true,
}: {
  userName: string;
  children: React.ReactNode;
  admin?: boolean;
  canConsult?: boolean;
}) {
  return (
    <>
      <header className="institutional-header">
        <div className="container header-content">
          <strong>Prefeitura de Pindamonhangaba</strong>
          <span>SETIP · Departamento de Sistemas de Informação</span>
        </div>
      </header>
      <div className="panel-bar container">
        <Link className="product-brand" href="/">
          Pinda Dados<span aria-hidden="true">.</span>
        </Link>
        <div className="session-controls">
          <span>{userName}</span>
          <LogoutButton />
        </div>
      </div>
      <nav className="panel-nav container" aria-label="Navegação principal">
        {canConsult && (
          <>
            <Link href="/consultations">Consultas</Link>
            <Link href="/consultations/audit">Auditoria de consultas</Link>
          </>
        )}
        <Link href="/account">Minha conta</Link>
        {admin && (
          <>
            <Link href="/admin/users">Servidores e acessos</Link>
            <Link href="/admin/references">Domínios e códigos</Link>
          </>
        )}
      </nav>
      <main id="main" className="container panel-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="container">
        Pinda Dados · Uso restrito, finalidade administrativa e acesso auditado
      </footer>
    </>
  );
}
