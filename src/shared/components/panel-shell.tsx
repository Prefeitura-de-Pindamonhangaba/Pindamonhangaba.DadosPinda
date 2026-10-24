import Link from "next/link";
import { LogoutButton } from "@/modules/auth/views/logout-button";
import {
  InstitutionalHeader,
  InstitutionalFooter,
} from "./institutional-header";
import { PanelNavigation } from "./panel-navigation";

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
      <InstitutionalHeader />
      <div className="panel-bar container">
        <Link className="product-brand" href="/">
          Pinda Dados<span aria-hidden="true">.</span>
        </Link>
        <div className="session-controls">
          <span>{userName}</span>
          <LogoutButton />
        </div>
      </div>
      <PanelNavigation admin={admin} canConsult={canConsult} />
      <main id="main" className="container panel-main" tabIndex={-1}>
        {children}
      </main>
      <InstitutionalFooter />
    </>
  );
}
