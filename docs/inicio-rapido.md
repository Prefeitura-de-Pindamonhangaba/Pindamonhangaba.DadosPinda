# Início rápido

Instale Docker com Compose e baixe o projeto. Crie `.env` copiando `.env.example` e preencha:

| Variável                 | Valor necessário                                                   |
| ------------------------ | ------------------------------------------------------------------ |
| `POSTGRES_PASSWORD`      | Senha exclusiva compatível com URL (ou codificada percentualmente) |
| `BETTER_AUTH_SECRET`     | Segredo aleatório com pelo menos 32 caracteres                     |
| `INITIAL_ADMIN_NAME`     | Nome da pessoa responsável                                         |
| `INITIAL_ADMIN_EMAIL`    | E-mail da primeira conta                                           |
| `INITIAL_ADMIN_PASSWORD` | Senha exclusiva entre 12 e 128 caracteres                          |

Mantenha `APP_URL=http://localhost:3000` e `ALLOW_LOCAL_HTTP=true` para uso local. Execute na pasta do projeto:

```sh
docker compose up --build -d
```

Abra http://localhost:3000 e entre com a conta configurada. Não são necessários comandos de instalação, migração ou criação de usuário. A primeira compilação pode levar alguns minutos.

## Dados e reinicialização

```sh
docker compose ps -a
docker compose logs init app
docker compose down
docker compose up --build -d
```

O serviço `init` termina com código zero após preparar o banco. `down` preserva os dados; não use `down -v` para atualizar. A primeira conta só é criada se o banco não tiver usuários. Alterar a senha no `.env` não redefine contas existentes; utilize a administração de contas.

Se faltar configuração, corrija `.env` e execute novamente o Compose. O PostgreSQL não publica porta. Se a porta 3000 estiver ocupada, ajuste o mapeamento de portas no Compose e `APP_URL` juntos.

## Credenciais e integração

O modelo não contém chaves reais. `.env` e certificados são ignorados pelo Git e excluídos do build. Para consultas reais, configure as chaves independentes de cache e auditoria (64 caracteres hexadecimais cada), certificado e credenciais conforme [Infoconv](infoconv.md). Até lá mantenha `INFOCONV_ENABLED=false`.

## Produção

Use `ALLOW_LOCAL_HTTP=false`, URL HTTPS e proxy TLS. A inicialização automática é exclusiva de loopback local; em produção aplique migrações e provisione contas separadamente conforme [operação](operacao.md).

O Compose padrão lê as variáveis Infoconv do `.env`. Guarde o certificado e a cadeia em `certificates/infoconv.pem` e `certificates/infoconv-ca.pem` (ou configure `INFOCONV_CERTIFICATES_DIR`). A pasta é ignorada pelo Git e pelo build e montada somente para leitura. Depois de configurar e habilitar a integração, execute o mesmo `docker compose up --build -d`; o overlay antigo continua disponível para caminhos individuais.
