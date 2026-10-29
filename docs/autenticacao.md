# Login e proteção interna

A identidade e a autorização são gerenciadas no Keycloak. Consulte [configuração e papéis](keycloak.md) para preparar o cliente uma única vez. Usuários autorizados são provisionados automaticamente no primeiro login, sem cadastro nem vínculo local.

## Papéis

Os client roles `viewer`, `operator` e `admin` do cliente definido em `KEYCLOAK_CLIENT_ID` são convertidos para as permissões fixas do Pinda Dados. Papéis do realm e de outros clientes não são aceitos. Quem não tem um papel reconhecido não entra. O nome e o papel são sincronizados a partir do ID token validado, com auditoria; as permissões são verificadas no servidor.

A administração de usuários da aplicação é somente de leitura. Cadastro, bloqueio, senha, recuperação, MFA e concessão ou remoção de papéis ficam no Keycloak. O banco local preserva identificadores e rastreabilidade; não é a fonte de autorização.

## Sessões

Better Auth gerencia OIDC, assinatura/JWKS, state, nonce, PKCE, cookies e proteção CSRF. Sessões de até oito horas usam cookies HttpOnly, SameSite=Lax e Secure em HTTPS; não há login por senha nem cadastro público. E-mail não é exigido nem usado como chave.

O backend consulta a autoridade do Keycloak pela renovação do token e validação do novo ID token na primeira requisição interna e, depois, a cada até 60 segundos de uso por instância. Mudanças de papel são sincronizadas. Falhas, remoção de papéis, bloqueio ou revogação no Keycloak encerram as sessões locais na próxima verificação. Não se concede acesso com base em dados antigos se essa verificação falhar. Logout local preserva o SSO global.

## Ambiente e operação

Configure APP_URL exata, BETTER_AUTH_SECRET exclusivo e as variáveis Keycloak, somente no backend. Não é necessário INITIAL_ADMIN_* nem executar comandos de vínculo. O primeiro administrador recebe o client role admin diretamente no Keycloak. Não há administrador inicial escolhido automaticamente pela aplicação.

Não edite contas ou papéis diretamente no banco para conceder acesso. Contas antigas sem vínculo Keycloak são preservadas para auditoria e não autenticam. Contas previamente vinculadas preservam UUID; seus papéis passam a seguir o Keycloak.

## Proteções

- Rotas internas exigem sessão e permissão no servidor. APIs usam 401/403 e páginas redirecionam para login.
- POST exige Origin correspondente a APP_URL; o controller expõe somente início de SSO, callback, sessão e saída. Endpoints locais de senha/cadastro permanecem bloqueados.
- Limites persistidos: cinco inícios de SSO por minuto/IP e 60 requisições/minuto nos demais endpoints de autenticação. O proxy sobrescreve X-Real-IP e impede acesso direto ao app.
- Auditoria registra provisionamento/sincronização de papéis e sessões, sem respostas cadastrais nem tokens em logs. O proxy não registra a query do callback.
- Senhas, tokens, certificados e banco ficam fora do repositório. HTTPS em produção permanece obrigatório.

Testes usam provedor fictício e PostgreSQL isolado. Consulte [testes](testes.md), [operação](operacao.md) e [Keycloak](keycloak.md).
