# Configuração e operação

## Ambiente

Copie `.env.example` para `.env`. Os valores de exemplo são apenas locais. Configure também `BETTER_AUTH_SECRET` com pelo menos 32 caracteres aleatórios; veja [autenticação e contas](autenticacao.md).

| Variável            | Uso                                                          |
| ------------------- | ------------------------------------------------------------ |
| `NODE_ENV`          | `development`, `test` ou `production`                        |
| `APP_URL`           | URL da aplicação; HTTPS obrigatório na validação de produção |
| `DATABASE_URL`      | Conexão PostgreSQL usada pelo cliente e pelo Drizzle Kit     |
| `POSTGRES_USER`     | Usuário do banco no Compose                                  |
| `POSTGRES_PASSWORD` | Senha do banco no Compose                                    |
| `POSTGRES_DB`       | Nome do banco no Compose                                     |

O Compose monta a conexão interna com host `db`. Use valores compatíveis com URL (codificação percentual quando necessário). Para desenvolvimento fora do Docker, configure um banco local em `DATABASE_URL`; o banco do Compose não publica porta. Mantenha ambientes e credenciais separados.

## Containers

```sh
docker compose up --build -d
docker compose ps
docker compose logs app
```

O app é publicado apenas em `127.0.0.1:3000`. O health check `/api/health` indica apenas disponibilidade HTTP, sem testar banco ou fontes externas. O volume `postgres_data` persiste o banco em rede interna. A aplicação executa como usuário `bun`, com dependências de produção e sem instalar Node.js.

Antes de produção, configurar `APP_URL` HTTPS, proxy reverso com TLS, segredos exclusivos e backups. A fundação não está pronta para acesso a dados pessoais. A validação de ambiente ocorre no uso de persistência e nas ferramentas de migração.

## Atualização e recuperação

1. Registrar a versão atual e fazer backup do banco antes de alterações relevantes.
2. Validar lint, tipagem, testes, build e imagem em homologação.
3. Revisar migrações e aplicá-las separadamente, sem execução automática no startup.
4. Subir a imagem aprovada e conferir health check e logs.
5. Em falha de aplicação, retornar à imagem anterior compatível com o schema. Em falha de dados, restaurar backup validado em ambiente isolado antes da troca.

Definir rotina de `pg_dump` com armazenamento protegido, retenção e testes de restauração conforme política municipal. Não remover volumes como procedimento de atualização. Nunca executar testes contra produção.

## Próximas decisões

Confirmar provedor SSO e políticas institucionais de identidade e retenção da auditoria. A integração SOAP Infoconv usa os perfis do legado e os WSDL oficiais, com cache criptografado por 7 dias. A franquia conjunta CPF/CNPJ é de 10.000 chamadas mensais; excedentes exigem liberação administrativa com ciência da cobrança, válida somente no mês corrente. Confira o saldo compartilhado no extrato SERPRO e programe a limpeza externa do cache. Consulte [integração, certificados e deploy](infoconv.md).
