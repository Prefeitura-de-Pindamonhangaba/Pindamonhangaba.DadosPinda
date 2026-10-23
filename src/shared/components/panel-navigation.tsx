"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function PanelNavigation({
  admin,
  canConsult,
}: {
  admin: boolean;
  canConsult: boolean;
}) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Início", visible: true },
    { href: "/consultations", label: "Consultas", visible: canConsult },
    {
      href: "/consultations/audit",
      label: "Auditoria de consultas",
      visible: canConsult,
    },
    { href: "/account", label: "Minha conta", visible: true },
    { href: "/admin/users", label: "Servidores e acessos", visible: admin },
    { href: "/admin/references", label: "Domínios e códigos", visible: admin },
  ];
  return (
    <div className="panel-nav-band">
      <nav className="panel-nav container" aria-label="Navegação principal">
        {links
          .filter((link) => link.visible)
          .map((link) => (
            <Link
              href={link.href}
              key={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
      </nav>
    </div>
  );
}
