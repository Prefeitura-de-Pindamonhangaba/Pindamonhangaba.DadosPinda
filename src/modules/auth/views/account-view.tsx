export function AccountView() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Conta institucional</span>
          <h1>Minha conta</h1>
          <p>
            Seu acesso ao Pinda Dados utiliza a conta institucional da
            Prefeitura.
          </p>
        </div>
      </div>
      <section aria-labelledby="account-access-title">
        <h2 id="account-access-title">Senha e recuperação de acesso</h2>
        <p>
          A alteração e a recuperação da senha são realizadas no acesso
          institucional. Em caso de dificuldade, entre em contato com o DSI.
        </p>
        <p>
          Seu nome e suas permissões são sincronizados do Keycloak
          institucional.
        </p>
      </section>
    </>
  );
}
