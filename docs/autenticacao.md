# Login e proteção interna

## Decisão

O Keycloak é a única forma de autenticação, usando OpenID Connect (Authorization Code + PKCE S256) pelo Better Auth com adapter Drizzle/PostgreSQL. O SDK gerencia sessão, cookies e CSRF; a aplicação preserva UUID interno, RBAC e auditoria. Consulte [Keycloak](keycloak.md) para configurar o cliente e vincular cada conta explicitamente.

A página pública apresenta o Pinda Dados com um único botão **Login**. Não recebe senhas. A senha e sua recuperação ficam no acesso institucional. Com `KEYCLOAK_ENABLED=false`, o botão fica desabilitado e informa indisponibilidade, sem alternativa local. A configuração incompleta habilitada falha com os nomes dos campos pendentes, sem revelar valores.

## Ambiente e banco

`APP_URL` deve corresponder à origem exata usada no navegador, inclusive porta. Configure `BETTER_AUTH_SECRET` com pelo menos 32 caracteres aleatórios, apenas no backend, e preserve-o entre reinícios. Em produção, use HTTPS. O build não exige acesso ao banco; a autenticação valida o ambiente ao ser utilizada. Veja [início rápido](inicio-rapido.md) e [operação](operacao.md).

## Contas e autorização

Não há cadastro público, associação automática por e-mail ou importação de papéis do Keycloak. A conta deve existir localmente, estar ativa e ter vínculo explícito com issuer e subject. A administração local controla os papéis; o acesso técnico ao Keycloak não concede autorização a dados cadastrais.

O papel `viewer` acessa painel e conta; `operator` consulta CPF/CNPJ, processa lotes e exporta resultados próprios; `admin` também acessa auditoria global, atualizações no SERPRO e administração. Papéis e permissões desconhecidos são negados no servidor. O último administrador ativo não pode ser desativado ou rebaixado pelo painel.

O cadastro e a edição em `/admin/users` não pedem senhas. Contas importadas são criadas desativadas; vincule-as ao Keycloak e ative individualmente. “Minha conta” orienta sobre senha e recuperação institucionais.

O provisionamento inicial e as ferramentas de console legadas ainda aceitam uma senha local para preservar compatibilidade do banco e da instalação. Essa credencial não permite login e não deve ser a senha institucional. Redefini-la por ferramentas antigas não altera a senha do Keycloak. Contas e registros existentes não são apagados nesta mudança.

Para desativar pelo console:

```powershell
@{ action = 'disable'; email = 'servidor@example.org' } |
  ConvertTo-Json -Compress | bun run users:manage
```

Controle o acesso ao console e ao banco. Para interromper imediatamente o acesso ao Pinda Dados, desative a conta local: desativar somente no Keycloak não revoga automaticamente sessões locais já emitidas.

## Proteções

- Rotas internas exigem sessão e permissão no servidor. APIs retornam 401/403 e páginas redirecionam para `/login`. Falhas não liberam acesso.
- Cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Sessões de até oito horas, sem renovação nem cache em cookie. Logout revoga a sessão local, preservando o SSO global do Keycloak.
- Controller expõe apenas início de SSO, callback Keycloak, leitura de sessão e saída. Login e cadastro por senha, troca e recuperação locais retornam 404. `emailAndPassword` também está desabilitado no SDK.
- POST exige `Origin` igual a `APP_URL`; state, PKCE e validação do ID token ficam no SDK. O callback é limitado ao provider Keycloak e a retornos internos definidos pelo sistema.
- Limites persistidos no PostgreSQL: cinco inícios de SSO por minuto por IP e 60 requisições por minuto nos demais endpoints de autenticação. O proxy deve sobrescrever `X-Real-IP` e impedir acesso direto ao app. IPs compartilhados compartilham limites.
- Auditoria registra conta, sessão, saída e alterações administrativas, sem tokens nem respostas cadastrais. Logs técnicos usam eventos sanitizados; não registre a URL bruta do callback OIDC.

## Testes

Execute `bun test` para configuração e autorização. O fluxo OIDC assinado e o Playwright exigem PostgreSQL local isolado com nome terminado em `_test`; veja [testes](testes.md). O app de navegador usa porta 3101 e o provedor fictício usa 3102. Nenhum teste acessa o Keycloak institucional.

Referências: [Better Auth](https://better-auth.com/docs/installation), [sessões](https://better-auth.com/docs/concepts/session-management) e [Keycloak](keycloak.md).
