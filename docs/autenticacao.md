# Login e proteção interna

## Decisão

Usar Better Auth 1.7.12 com adapter Drizzle/PostgreSQL para login por e-mail e senha. A biblioteca gerencia hashes, cookies, sessões e proteções CSRF. A configuração central permite acrescentar OIDC/SSO depois. Cadastro público está desativado. Administradores gerenciam servidores em `/admin/users`; os próprios usuários podem alterar senha em `/account`. Não há envio de senhas por e-mail.

## Ambiente e banco

`APP_URL` deve ser a origem exata usada no navegador, inclusive porta. Configure `BETTER_AUTH_SECRET` com pelo menos 32 caracteres aleatórios, somente no backend. Preencha a variável existente no `.env` com um segredo aleatório exclusivo; não acrescente uma segunda definição. Para instalação local completa, use o [início rápido](inicio-rapido.md).

Em produção, use gerenciador de segredos, `NODE_ENV=production` e `APP_URL` com HTTPS. Preserve o segredo entre reinícios e réplicas. O build não exige banco nem segredo; o uso da autenticação valida o ambiente.

```powershell
docker compose -f compose.yml -f compose.dev.yml up -d db
bun run db:migrate
```

O override publica PostgreSQL em `127.0.0.1:55432` e desativa o isolamento de rede exclusivamente no desenvolvimento. Configure `DATABASE_URL` com essa porta. Não use esse override em produção. Migrações são aplicadas separadamente do startup.

## Contas

Não existe senha padrão no código. Senhas têm de 12 a 128 caracteres. E-mails são normalizados para minúsculas; UUID é o identificador interno. O operador do console controla o provisionamento. Exemplo PowerShell com senha fora dos argumentos e do histórico:

```powershell
$credential = Get-Credential -Message 'E-mail e senha da nova conta'
@{
  name = 'Nome do servidor'
  email = $credential.UserName
  password = $credential.GetNetworkCredential().Password
  role = 'viewer'
} | ConvertTo-Json -Compress | bun run users:create
Remove-Variable credential
```

O papel `viewer` acessa somente painel e conta. `operator` consulta CPF/CNPJ no Infoconv, processa lotes e exporta resultados próprios. `admin` também acessa auditoria global, atualiza dados diretamente no SERPRO e gerencia servidores e domínios. Papéis e permissões desconhecidos são negados; todas as verificações ocorrem no servidor. A lista de permissões fica em `modules/auth/permissions.ts`. O último administrador ativo não pode ser desativado ou rebaixado pelo painel.

## Desativar ou redefinir senha

```powershell
@{ action = 'disable'; email = 'servidor@example.org' } |
  ConvertTo-Json -Compress | bun run users:manage

$credential = Get-Credential -Message 'E-mail e nova senha'
@{
  action = 'reset-password'
  email = $credential.UserName
  password = $credential.GetNetworkCredential().Password
} | ConvertTo-Json -Compress | bun run users:manage
Remove-Variable credential
```

As operações revogam todas as sessões em transação e geram auditoria. Redefinir senha não reativa usuário desativado. Controle o acesso ao console e ao banco: a auditoria identifica o usuário afetado; a identificação do operador depende dos controles do host nesta fase.

## Proteções

- Proxy verifica sessão no servidor em todas as rotas internas. O controller da página também exige `panel:read`; novos controllers devem exigir a permissão correspondente. APIs retornam 401/403; páginas redirecionam para `/login`. Falhas não liberam acesso.
- Cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Sessão com duração máxima de 8 horas, sem renovação ou cache em cookie. Logout revoga a sessão no banco.
- POST de autenticação exige `Origin` igual à origem configurada; as proteções CSRF da biblioteca permanecem ativas. O controller expõe login, logout, leitura de sessão e troca de senha autenticada. A troca exige a senha atual e revoga as demais sessões.
- Limites persistidos em PostgreSQL: 5 tentativas por minuto por IP no login e 60 requisições por minuto nos demais endpoints de autenticação. O proxy de produção deve sobrescrever `X-Real-IP` e impedir acesso direto ao app; nunca confiar nesse cabeçalho enviado pelo cliente. IPs compartilhados compartilham limites.
- Auditoria registra criação da conta, entrada, saída, desativação e redefinição de senha, com usuário, horário UTC e correlação. Não registra senha, token nem resposta cadastral. Não há interface pública de auditoria. Logs técnicos usam eventos fixos sem argumentos sensíveis do SDK.
- Defina retenção, acesso à auditoria e política institucional de contas antes de produção.

## Testes

`bun test` cobre validação e autorização. O Playwright exige banco local exclusivo com nome terminado em `_test`; a aplicação de teste roda na porta 3101 com saída de build e segredo próprios.

```powershell
# Crie o banco uma única vez:
docker exec pindamonhangabadadospinda-db-1 createdb -U pinda pinda_dados_test
$env:AUTH_TEST_DATABASE_URL = 'postgresql://pinda:local-development-only@127.0.0.1:55432/pinda_dados_test'
bun run test:e2e
```

Ajuste credenciais conforme seu ambiente. O teste de navegador usa Edge instalado. A CLI Playwright usa o launcher padrão `bunx`; o runner Bun direto apresentou incompatibilidade na transformação TypeScript nesta combinação de versões. A aplicação e os testes unitários usam Bun. O desenvolvimento usa Webpack para evitar recargas contínuas observadas com Turbopack nesta combinação; o build de produção usa Turbopack. Os scripts definem `NODE_ENV` explicitamente para evitar que o `.env` local altere o build de produção. Nunca use banco de produção.

Referências: [Better Auth](https://better-auth.com/docs/installation), [Drizzle](https://better-auth.com/docs/adapters/drizzle), [sessões](https://better-auth.com/docs/concepts/session-management), [limites](https://better-auth.com/docs/concepts/rate-limit).

Na instalação local via Compose, a primeira conta administradora é criada a partir de `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` somente quando o banco não possui usuários. Consulte o [início rápido](inicio-rapido.md).

## Keycloak

O login institucional opcional é configurado no `.env`. Veja [Keycloak](keycloak.md) para ativação, cliente, vinculação explícita dos usuários e comportamento de saída. Os papéis e a desativação continuam locais; autenticação não concede acesso automaticamente.
