# Login institucional com Keycloak

A integração usa OpenID Connect (Authorization Code + PKCE S256) pelo provider Keycloak do Better Auth já instalado. Não adiciona biblioteca de autenticação nem altera o schema do banco. As contas continuam com UUID interno, RBAC e auditoria locais.

## Configuração exclusivamente no .env

As configurações ficam no `.env` privado de cada instalação; `.env.example` contém somente o modelo. Nunca use `NEXT_PUBLIC_` para essas variáveis:

```env
KEYCLOAK_ENABLED=false
KEYCLOAK_ALLOW_INSECURE_HTTP=false
KEYCLOAK_ISSUER=
KEYCLOAK_CLIENT_ID=
KEYCLOAK_CLIENT_SECRET=
```

Preencha `KEYCLOAK_ISSUER` com a URL HTTPS completa do realm, por exemplo `https://sso.seu-orgao.example/realms/prefeitura`, e informe ID e segredo do cliente confidencial. Habilite `KEYCLOAK_ENABLED=true` somente após configurar o cliente e preparar os usuários. A URL não deve conter credenciais, query string ou fragmento. TLS precisa ser confiável para o navegador e os containers.

O Compose transmite as variáveis apenas ao backend. A tela recebe somente o indicador de disponibilidade do login institucional; o segredo nunca é enviado ao navegador. A configuração habilitada incompleta bloqueia a validação de ambiente e o pré-deploy com os nomes dos campos pendentes, sem exibir valores. Desabilitada, não exige conexão ou credenciais Keycloak.

Para um teste temporário com IdP HTTP, habilite explicitamente `KEYCLOAK_ALLOW_INSECURE_HTTP=true`. A exceção exige `COMPOSE_PROFILES=development` e `APP_URL` HTTP em `localhost`, `127.0.0.1` ou `::1`. Sem Compose, exige `NODE_ENV=development` e a mesma origem local. Em produção HTTP continua recusado mesmo com a flag habilitada. Nesse teste o segredo do cliente e os tokens trafegam sem TLS até o IdP; use somente o ambiente de desenvolvimento autorizado e remova a exceção ao configurar HTTPS.

## Cliente no Keycloak

No realm escolhido, configure um cliente OpenID Connect confidencial:

- Client authentication: habilitada.
- Standard flow: habilitado; PKCE S256.
- Implicit flow, Direct access grants e Service accounts: desabilitados para esse cliente.
- Valid redirect URI de produção: `https://dados.pindamonhangaba.sp.gov.br/api/auth/callback/keycloak`.
- Web origin de produção: `https://dados.pindamonhangaba.sp.gov.br`.
- Scopes: `openid`, `profile` e `email`, com `email_verified=true` para os usuários autorizados.

Use origens e redirects exatos, sem curingas. Para desenvolvimento crie cliente separado, com callback `http://localhost:3000/api/auth/callback/keycloak` e origin `http://localhost:3000`; ajuste a porta conforme `APP_URL`. O issuer Keycloak permanece HTTPS, salvo a exceção temporária explícita de desenvolvimento descrita acima. O endpoint discovery é derivado do issuer conforme a documentação oficial; não há endpoints administrativos ou credenciais fixados no código.

## Provisionamento e autorização

Não há cadastro automático, associação por e-mail nem importação automática de papéis do realm. Antes do primeiro login institucional:

1. Provisione a conta no Pinda Dados, atribua o menor papel necessário e deixe-a ativa, conforme [autenticação](autenticacao.md).
2. Obtenha o UUID interno da conta e de um administrador ativo (retornados pelo provisionamento ou pela API administrativa).
3. Obtenha o `sub` imutável que o cliente OIDC recebe do Keycloak. No padrão do Keycloak corresponde ao identificador do usuário; confirme eventuais mappers/pairwise subjects.
4. Execute a vinculação administrativa por entrada padrão. Exemplo PowerShell:

```powershell
@{
  action = 'link'
  actorId = 'UUID_DO_ADMINISTRADOR_LOCAL'
  userId = 'UUID_DO_USUARIO_LOCAL'
  subject = 'SUB_DO_USUARIO_KEYCLOAK'
} | ConvertTo-Json -Compress | bun run users:keycloak
```

Em produção com ferramentas Docker, envie o mesmo JSON a `docker compose run --rm -T tools users:keycloak` (acrescente os arquivos/variáveis de imagem da release quando usar GHCR, conforme [GitHub Actions](github-actions.md)).

A chave de vínculo inclui `issuer` e `sub`, portanto identidades de realms diferentes não se confundem. Um usuário tem apenas um vínculo Keycloak; uma identidade não pode pertencer a duas contas locais. Para trocar realm ou identidade, remova o vínculo anterior e vincule novamente, com revisão administrativa. Não edite a tabela de contas manualmente.

Para remover:

```json
{ "action": "unlink", "actorId": "UUID_ADMIN", "userId": "UUID_USUARIO" }
```

Use o mesmo comando por stdin. A remoção funciona inclusive com o Keycloak desabilitado. Vincular e remover exigem administrador local ativo, revogam sessões locais do usuário e registram responsável e usuário na auditoria. O fluxo OIDC continua negando usuários desativados e não altera seus papéis, nomes ou e-mails locais com claims do provider.

O callback carrega authorization code e state na URL. O modelo Nginx desabilita logs brutos especificamente nesse endpoint; o diagnóstico fica nos eventos sanitizados da aplicação. Aplique a mesma política em proxies e monitoramento externos e não habilite logs de debug com tokens/corpos das requisições.

## Sessões, saída e limites desta etapa

A assinatura do ID token é verificada pelo SDK usando JWKS do discovery; são verificados audience, issuer e nonce. A aplicação ainda confere o issuer configurado e e-mail verificado. Tokens OAuth persistidos são criptografados pelo Better Auth com `BETTER_AUTH_SECRET`; mantenha esse segredo protegido e estável. State e PKCE são gerenciados pelo SDK, sem implementação criptográfica própria.

O login local permanece habilitado para contingência e a senha local continua independente do Keycloak. O botão institucional aparece somente quando a configuração está habilitada. Falhas são apresentadas em português sem reproduzir mensagens do provider.

**Sair encerra e revoga a sessão do Pinda Dados.** Nesta etapa a sessão SSO global do Keycloak é preservada, evitando encerrar outros sistemas institucionais. Entrar novamente pode reutilizar a sessão já aberta no Keycloak. Backchannel logout, sincronização de grupos/papéis e revogação remota imediata não estão implementados.

Desabilitar uma conta apenas no Keycloak impede novos logins conforme a política do provider, mas não elimina automaticamente sessões locais já emitidas. Para interrupção imediata no Pinda Dados, desative o usuário na administração local. As sessões locais mantêm o prazo existente de oito horas.

## Validação

`bun test` cobre configuração, identificação por realm/subject e entrada segura. O teste de fluxo assinado exige `KEYCLOAK_TEST_DATABASE_URL` apontando para PostgreSQL local isolado com sufixo `_test`:

```sh
bun test --timeout 30000 tests/keycloak-flow.test.ts
```

O teste utiliza um provider fictício com tokens RSA assinados e JWKS localmente simulados, sem conexão a Keycloak real. Verifica PKCE, vínculo explícito, permissões preservadas, tokens criptografados, replay, nonce, issuer, audience, expiração, e-mail não verificado e usuários não autorizados/desativados. A CI executa esse teste no mesmo PostgreSQL efêmero reservado ao job de navegador, antes do Playwright.

A homologação com o realm real ainda deve confirmar login, conta sem vínculo, conta desativada, recuperação local, logout e URLs de retorno. Nenhuma instância ou cliente Keycloak é criado automaticamente pela aplicação.

Referências: [Better Auth Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth) e [Keycloak OpenID Connect](https://www.keycloak.org/securing-apps/oidc-layers).
