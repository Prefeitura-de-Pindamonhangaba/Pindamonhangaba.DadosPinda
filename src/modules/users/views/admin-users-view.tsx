import type { Role } from "@/modules/auth/permissions";
const labels = {
  viewer: "Visualizador",
  operator: "Operador de consultas",
  admin: "Administrador",
};
export function AdminUsersView({
  initialUsers,
}: {
  initialUsers: { id: string; name: string; role: Role; enabled: boolean }[];
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Acesso institucional</span>
          <h1>Servidores e acessos</h1>
          <p>
            Cadastro, papéis, senha, MFA e bloqueio são gerenciados
            exclusivamente no Keycloak.
          </p>
        </div>
      </div>
      <p>
        Os registros abaixo são criados automaticamente no primeiro login
        autorizado. O papel é sincronizado com o cliente do Pinda Dados no
        Keycloak.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Servidor</th>
              <th>Papel sincronizado</th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{labels[item.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
