import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pinda Dados | Prefeitura de Pindamonhangaba",
  description: "Plataforma institucional de consulta e integração cadastral.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#main">
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
