# Login e proteção interna

## Decisão

Usar Better Auth 1.7.12 com adapter Drizzle/PostgreSQL para login por e-mail e senha. A biblioteca gerencia hashes, cookies, sessões e proteções CSRF. Contas locais atendem ao acesso simples solicitado; a configuração central permite acrescentar OIDC/SSO depois. Cadastro público está desativado. Não há envio de e-mail ou administração web nesta etapa.

## Ambiente e banco

`APP_URL` deve ser a origem exata usada no navegador, inclusive porta. Configure `BETTER_AUTH_SECRET` com pelo menos 32 caracteres aleatórios, somente no backend. Gere sem imprimir no terminal, apenas se a variável ainda não existir:

```powershell
$secretBytes = [byte[]]::new(48)
[Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
Add-Content .env ("BETTER_AUTH_SECRET=" + [Convert]::ToBase64String($secretBytes))
```

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

Papéis `viewer` e `admin` possuem apenas `panel:read` nesta etapa. Não há concessão de acesso a CPF, CNPJ ou fontes externas, nem funcionalidades administrativas web. Papéis e permissões desconhecidos são negados.

Na instalação local desta tarefa foi criada a conta fictícia `admin@pinda.local`, com senha aleatória em `.local/login-inicial.json`. O arquivo está ignorado pelo Git e Docker. Use somente para desenvolvimento e exclua-o depois de guardar a senha em local protegido. Novas instalações não criam contas automaticamente.

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
- POST de autenticação exige `Origin` igual à origem configurada; as proteções CSRF da biblioteca permanecem ativas. O controller expõe apenas login, logout e leitura de sessão.
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
