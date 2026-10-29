# Keycloak: gestão central de usuários e acessos

O Keycloak controla usuários, nome, senha, recuperação, MFA, bloqueio, sessões e papéis. O Pinda Dados usa Better Auth como biblioteca OIDC e mantém UUID interno, sessões e auditoria. Não é necessário cadastro nem vínculo manual na aplicação.

## Configuração no .env

```env
KEYCLOAK_ENABLED=true
KEYCLOAK_ISSUER=https://sso.seu-orgao.example/realms/prefeitura
KEYCLOAK_CLIENT_ID=pinda-dados
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_ALLOW_INSECURE_HTTP=false
```

O segredo fica exclusivamente no backend. `APP_URL` deve corresponder à origem pública exata, com HTTPS em produção. Com Keycloak desabilitado, somente a apresentação fica disponível; não há login alternativo.

## Configurar uma vez no Keycloak

1. Use um cliente OpenID Connect confidencial, com **Client authentication** e **Standard flow** habilitados, PKCE S256 e renovação por refresh token habilitada (padrão do cliente). Desabilite Implicit flow, Direct access grants e Service accounts para esse cliente.
2. Configure o callback exato `APP_URL/api/auth/callback/keycloak` e a Web origin igual a `APP_URL`, sem curingas. Exemplo de produção: `https://dados.pindamonhangaba.sp.gov.br/api/auth/callback/keycloak`. Para testes locais, ajuste host e porta conforme a instalação.
3. Em **Clients → seu cliente → Roles**, crie os client roles `viewer`, `operator` e `admin`.
4. Configure um mapper de **User Client Role**, no client scope dedicado do cliente (ou no scope `roles` atribuído como padrão). Selecione o cliente do Pinda Dados; use claim **`resource_access.${client_id}.roles`**, multivalorado, tipo String, com **Add to ID token** habilitado. O resultado no ID token deve conter o ID exato definido em `KEYCLOAK_CLIENT_ID`:

```json
{
  "resource_access": {
    "pinda-dados": { "roles": ["operator"] }
  }
}
```

Troque `pinda-dados` pelo seu client ID. O scope padrão `roles` normalmente envia papéis no access token; esta integração precisa recebê-los também no **ID token**, validado pelo SDK. Não use tokens reais em sites públicos para inspecioná-los.

5. Em **Users → usuário → Role mapping**, atribua um desses papéis do cliente. Você também pode usar grupos e papéis compostos do Keycloak para organizar a atribuição.
6. Para o primeiro administrador, atribua `admin` no cliente e faça login. A conta local será criada automaticamente; não existe comando de vínculo nem senha inicial local.

| Client role | Acesso                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| `viewer`    | Painel e conta                                                                                                 |
| `operator`  | Consultas CPF/CNPJ, lotes, exportação e histórico autorizado                                                   |
| `admin`     | Operação, auditoria global, atualização no SERPRO, franquia e domínios; visualização dos acessos sincronizados |

Se houver mais de um papel reconhecido, prevalece `admin`, depois `operator`, depois `viewer`. Ausência de papel reconhecido nega acesso. Papéis do realm ou de outros clientes não concedem permissão, mesmo se chamados `admin`. Restrinja quem pode atribuir esses papéis no Keycloak.

## Provisionamento e autorização

O SDK verifica assinatura, issuer, audience, nonce, state e PKCE. A aplicação usa exclusivamente issuer e `sub` imutável para identificar a pessoa. Após validar o papel, cria o registro local de forma idempotente, inclusive com logins concorrentes, e registra auditoria. Nome e papel são sincronizados a partir do token validado.

Nenhuma claim de e-mail é exigida ou usada para associação. O SDK exige um campo técnico de e-mail no banco; para contas novas ele é gerado a partir do hash da identidade, no domínio reservado `identity.invalid`, sem uso para mensagens ou autenticação.

Contas previamente vinculadas preservam o UUID e os vínculos de auditoria. Contas locais antigas sem identidade Keycloak não são associadas por coincidência de e-mail. O primeiro login dessa pessoa cria outro registro seguro, ligado ao seu issuer/sub. Não apague registros históricos para ajustar acessos.

`/admin/users` mostra apenas o espelho das contas Keycloak; POST/PATCH de administração local são recusados. Os comandos legados `users:create`, `users:manage` e `users:keycloak` deixam de alterar usuários. `INITIAL_ADMIN_*` não é mais necessário e é ignorado pelo Compose.

## Mudanças, bloqueio e sessões

A cada até 60 segundos de uso por instância da aplicação, o backend renova o token no Keycloak e valida o ID token retornado pelo SDK. Papéis removidos ou alterados passam a valer nas próximas verificações. A primeira requisição interna depois do login também é verificada. Requisições simultâneas da mesma identidade na instância compartilham a verificação.

Para bloquear uma pessoa, desabilite-a no Keycloak, remova os papéis do cliente ou encerre suas sessões no Keycloak. Quando a renovação/validação falha, as sessões locais são revogadas; não há fallback para o papel armazenado. Durante a janela de até um minuto, uma operação já autorizada pode continuar. A indisponibilidade do Keycloak também bloqueia o acesso na próxima verificação.

**Sair** encerra a sessão do Pinda Dados; o SSO global é preservado para não encerrar outros sistemas. Para encerrar o acesso institucional, use a gestão de sessões do Keycloak. Backchannel logout individual por dispositivo não está implementado nesta etapa. As sessões locais continuam limitadas a oito horas, além das restrições do provedor.

## Diagnóstico

Se ocorrer `unable_to_get_user_info`, confira primeiro se há um client role reconhecido e se o mapper o envia no ID token, no client ID correto. Confira também issuer, assinatura, nonce e configuração TLS. O Pinda Dados não envia nem exige confirmação de e-mail; uma tela de Verify Email é política do próprio Keycloak.

O callback contém code e state; não registre sua URL bruta no proxy nem habilite logs com tokens. A auditoria registra provisionamento/sincronização e sessões sem armazenar as claims completas em logs.

Para HTTP temporário em desenvolvimento, `KEYCLOAK_ALLOW_INSECURE_HTTP=true` exige `COMPOSE_PROFILES=development` e `APP_URL` HTTP em loopback; sem Compose, exige `NODE_ENV=development`. Produção permanece exigindo HTTPS.

## Validação

`bun test` cobre seleção de papéis e identidade. O fluxo OIDC assinado exige PostgreSQL local isolado (`KEYCLOAK_TEST_DATABASE_URL` com sufixo `_test`) e usa um provedor fictício: provisionamento automático, ausência de e-mail, separação por identidade, atualização de papéis, revogação e rejeição de tokens inválidos.

Referências: [Keycloak OIDC](https://www.keycloak.org/securing-apps/oidc-layers), [client roles e mappers](https://www.keycloak.org/docs/latest/server_admin/index.html), [Better Auth Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth).
