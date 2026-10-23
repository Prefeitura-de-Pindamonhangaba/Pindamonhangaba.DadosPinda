import Image from "next/image";

export function InstitutionalHeader() {
  return (
    <header className="institutional-header">
      <div className="institutional-ribbon">
        <div className="container">
          Prefeitura de Pindamonhangaba{" "}
          <span>Governo digital · Sistemas institucionais</span>
        </div>
      </div>
      <div className="container header-content">
        <Image
          className="institutional-logo"
          src="/brand/prefeitura-pindamonhangaba.svg"
          alt="Prefeitura Municipal de Pindamonhangaba"
          width={300}
          height={126}
          priority
          unoptimized
        />
        <div className="institutional-department">
          <strong>Tecnologia a serviço da cidade</strong>
          <span>SETIP · Departamento de Sistemas de Informação</span>
        </div>
      </div>
    </header>
  );
}

export function InstitutionalFooter() {
  return (
    <footer className="institutional-footer">
      <div className="container footer-content">
        <div>
          <strong>
            Pinda Dados<span aria-hidden="true">.</span>
          </strong>
          <p>Informação integrada para a gestão municipal.</p>
        </div>
        <div>
          <strong>Prefeitura de Pindamonhangaba</strong>
          <p>SETIP · Departamento de Sistemas de Informação</p>
          <span>
            Uso restrito · Finalidade administrativa · Acesso auditado
          </span>
        </div>
      </div>
    </footer>
  );
}
