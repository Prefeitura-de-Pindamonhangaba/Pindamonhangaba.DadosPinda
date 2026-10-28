# Início rápido

Requisito: Docker com Docker Compose. Não é necessário instalar Bun, Node.js ou PostgreSQL na máquina.

Copie `.env.example` para `.env`, mantenha `COMPOSE_PROFILES=development` e preencha:

| Variável                 | Valor                                                  |
| ------------------------ | ------------------------------------------------------ |
| `POSTGRES_PASSWORD`      | Senha exclusiva do banco local, sem codificação manual |
| `BETTER_AUTH_SECRET`     | Segredo aleatório de pelo menos 32 caracteres          |
| `INITIAL_ADMIN_NAME`     | Nome do responsável                                    |
| `INITIAL_ADMIN_EMAIL`    | E-mail da primeira conta                               |
| `INITIAL_ADMIN_PASSWORD` | Senha exclusiva de 12 a 128 caracteres                 |

Mantenha `APP_URL=http://localhost:3000` e `APP_PORT=3000`. Execute:

```sh
docker compose up --build -d
```

Abra http://localhost:3000. O Compose cria o PostgreSQL local, aguarda a conexão, aplica migrações e cria a conta inicial. `DATABASE_URL` é ignorada em desenvolvimento via Docker. Nas próximas subidas, contas e senhas são preservadas; alterar a senha inicial no `.env` não redefine contas existentes.

Para outra porta, ajuste `APP_PORT` e a porta de `APP_URL` juntos, sem editar o Compose.

## Login institucional

O Keycloak é a única forma de login. Configure `KEYCLOAK_ENABLED=true`, `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID` e `KEYCLOAK_CLIENT_SECRET` no `.env`, com o cliente e o callback correspondentes a `APP_URL`. Vincule a conta inicial ao `sub` do administrador conforme [Keycloak](keycloak.md#provisionamento-e-autorização). Essa vinculação explícita impede que a coincidência de e-mail conceda acesso.

A senha inicial ainda é exigida pelo provisionamento compatível com instalações anteriores, mas não permite login. Não use a senha institucional nesse campo. Senhas de acesso e recuperação são gerenciadas no Keycloak. Com Keycloak desabilitado, a apresentação exibe indisponibilidade e não permite autenticação.

## Conferir ou reiniciar

```sh
docker compose ps -a
docker compose logs init app db
docker compose down
docker compose up --build -d
```

O serviço `init` deve terminar com código zero. Se falhar, seus logs indicam o que corrigir; a aplicação não inicia até a verificação passar. `down` preserva o volume; não use `down -v` para atualizar.

## Produção

Altere o seletor para `COMPOSE_PROFILES=production`, informe `DATABASE_URL` do servidor externo e configure `APP_URL` HTTPS. O comando de subida permanece igual e o banco local não é criado. Migrações e primeira conta são preparadas explicitamente antes do deploy; veja [operação](operacao.md). Utilize bancos e segredos diferentes por ambiente.

## Infoconv e segredos

O `.env.example` contém apenas o modelo; `.env` e certificados ficam fora do Git e do build. Mantenha `INFOCONV_ENABLED=false` até configurar suas credenciais. Ao habilitar, preencha as chaves independentes e coloque certificado/chave privada e cadeia em `certificates/infoconv.pem` e `certificates/infoconv-ca.pem` ou ajuste `INFOCONV_CERTIFICATES_DIR`. A pasta é montada somente para leitura. O pré-deploy valida os arquivos sem consultar o SERPRO. Veja [integração](infoconv.md).

O certificado Infoconv também pode ser `.pfx`/`.p12`: configure caminho, formato e senha no `.env` conforme [certificados PFX](infoconv.md#certificado-pfx--pkcs12). O bundle de CAs, quando usado, continua PEM.
