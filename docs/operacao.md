# Operação e deploy

## Um seletor para os dois ambientes

Configure `COMPOSE_PROFILES` no `.env` com **um único valor**:

| Valor         | Banco                                                    | Inicialização                                                                   |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `development` | PostgreSQL local criado pelo Compose, sem publicar porta | Aguarda o banco, aplica migrações e cria o primeiro administrador               |
| `production`  | Servidor externo informado em `DATABASE_URL`             | Verifica configuração, conexão, migrações e administrador; não modifica o banco |

O comando de subida é o mesmo:

```sh
docker compose up --build -d
```

`NODE_ENV` não seleciona o ambiente Docker: ambos executam o build otimizado com Bun. O seletor controla a topologia e a política de segurança. Em produção, HTTP é recusado mesmo se `ALLOW_LOCAL_HTTP` legado estiver habilitado.

## Desenvolvimento

Copie `.env.example` para `.env`, mantenha `COMPOSE_PROFILES=development` e preencha `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` e `INITIAL_ADMIN_*`. Configure `APP_URL=http://localhost:3000`. `DATABASE_URL` é ignorada nesse modo Docker, evitando conexão acidental a um banco externo. Usuário, senha e nome do banco local são codificados automaticamente para a URL de conexão; preencha os valores brutos.

O serviço `init` aguarda o banco por tempo limitado. Na primeira subida prepara o schema e a conta; nas demais preserva os usuários e suas senhas. Veja [início rápido](inicio-rapido.md).

## Produção com banco externo

Configure no `.env`:

```env
COMPOSE_PROFILES=production
APP_URL=https://dados.seu-orgao.example
DATABASE_URL=postgresql://USUARIO:SENHA_CODIFICADA@SERVIDOR:5432/BANCO?sslmode=require
BETTER_AUTH_SECRET=SEU_SEGREDO_ALEATORIO_DE_PELO_MENOS_32_CARACTERES
```

Substitua todos os exemplos. A senha na connection string deve ser codificada percentualmente quando necessário. Preserve as opções TLS exigidas pelo servidor; a aplicação não desabilita a verificação TLS nem remove parâmetros da connection string. `POSTGRES_*` e `INITIAL_ADMIN_*` não são necessários em produção. `localhost` dentro do container é a própria aplicação e não será aceito como banco externo.

Antes da primeira publicação, crie o banco e as permissões no servidor PostgreSQL. Faça backup antes de mudanças relevantes, revise o SQL das migrações e aplique explicitamente:

```sh
docker compose build tools
docker compose run --rm tools db:migrate
```

Crie a primeira conta administradora enviando JSON pela entrada padrão. Exemplo PowerShell, sem senha no histórico ou nos argumentos:

```powershell
$credential = Get-Credential -Message 'E-mail e senha da primeira conta administradora'
@{
  name = 'Administrador responsável'
  email = $credential.UserName
  password = $credential.GetNetworkCredential().Password
  role = 'admin'
} | ConvertTo-Json -Compress | docker compose run --rm -T tools users:create
Remove-Variable credential
```

Em Bash, solicite a senha sem eco e produza o JSON com uma ferramenta local de sua confiança; envie-o a `docker compose run --rm -T tools users:create`. O formato é `{ "name": "...", "email": "...", "password": "...", "role": "admin" }`. Não grave senhas em arquivos versionados.

Depois execute o comando normal de subida. Para verificar sem iniciar a aplicação:

```sh
docker compose build init
docker compose run --rm init
```

A verificação termina com código diferente de zero e orientação de correção quando faltar configuração, conexão, migração ou administrador. Quando Infoconv estiver habilitado, também verifica variáveis, chaves independentes e leitura/formato dos certificados. **Não faz consultas ao SERPRO.** Banco sem schema, permissões insuficientes e divergência de migrações exigem intervenção do operador; não há migração automática em produção.

## Rede, publicação e segredos

A aplicação publica apenas `127.0.0.1:${APP_PORT:-3000}` no host. Configure o proxy reverso com certificado TLS válido encaminhando para essa porta. `APP_URL` deve corresponder à origem HTTPS pública exata. O serviço de banco local não é iniciado em produção; aplicação, verificação e ferramentas possuem rede com saída para o servidor externo.

O pré-deploy verifica acesso do container ao banco e arquivos configurados, mas não comprova o certificado do proxy público, backups ou habilitação contratual. Verifique esses itens antes da publicação. O endpoint `/api/health` confirma somente disponibilidade HTTP.

Credenciais continuam no `.env`, fora do Git e do build. Certificados em `INFOCONV_CERTIFICATES_DIR` são montados somente para leitura. Consulte [Infoconv](infoconv.md) para contrato, limites, retenção e certificados. Desabilitar a fonte permite subir o sistema sem suas credenciais.

## Alternar instalações, atualizar e recuperar

Use instalações, segredos e bancos separados para desenvolvimento e produção. Se reutilizar uma pasta/um projeto Compose para trocar de ambiente, execute `docker compose down` **antes** de alterar o seletor; isso encerra o banco local que já estava em execução, preservando o volume. Depois ajuste as configurações e execute novamente `docker compose up --build -d`. O Compose não migra dados entre bancos.

Para atualizar produção: faça backup, valide a imagem em homologação, revise/aplique migrações pelo serviço `tools` e suba a versão aprovada. Não remova volumes nem use `down -v` como atualização. Em falha, retorne à imagem anterior compatível com o schema ou restaure um backup testado em ambiente isolado.

Defina rotina de backup protegido e teste de restauração conforme a política municipal; evite incluir o conteúdo de `consultation_cache` nos backups para respeitar a retenção de sete dias. Auditoria e logs técnicos permanecem separados. Nunca use produção para testes.
