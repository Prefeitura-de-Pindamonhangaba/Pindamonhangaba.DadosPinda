# Operação e deploy

## Um seletor para os dois ambientes

Configure `COMPOSE_PROFILES` no `.env` com **um único valor**:

| Valor         | Banco                                                    | Inicialização                                                   |
| ------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| `development` | PostgreSQL local criado pelo Compose, sem publicar porta | Aguarda o banco, aplica migrações; usuários vêm do Keycloak     |
| `production`  | Servidor externo informado em `DATABASE_URL`             | Verifica configuração, conexão, migrações; não modifica o banco |

O comando de subida é o mesmo:

```sh
docker compose up --build -d
```

`NODE_ENV` não seleciona o ambiente Docker: ambos executam o build otimizado com Bun. O seletor controla a topologia e a política de segurança. Em produção, HTTP é recusado mesmo se `ALLOW_LOCAL_HTTP` legado estiver habilitado.

## Build e tempo de subida

O comando permanece `docker compose up --build -d`. O Docker reaproveita as dependências do Bun e o cache de compilação do Next.js. Documentação, testes e arquivos locais não invalidam o build da aplicação. Não use `--no-cache` nem limpe o cache do builder nas atualizações rotineiras.

A aplicação usa a saída standalone do Next.js, executada com Bun. A imagem final contém apenas os arquivos rastreados, assets públicos e inicializador compilado. `init` usa uma imagem pequena com o bootstrap compilado e migrações; `tools` continua disponível com as ferramentas completas. A imagem `tooling` também contém `runtime/bootstrap.js`, mantendo a compatibilidade do overlay de release e do GitHub Actions.

`NEXT_BUILD_CPUS=2` limita os processos de geração de páginas no build Docker, reduzindo a pressão de memória em VMs pequenas. Aceita valores de 1 a 32 no `.env`; isso não altera a quantidade de processos de atendimento da aplicação nem o seletor de ambiente. O build local com Bun mantém o comportamento padrão do Next.js se a variável não estiver definida.

Medições indicativas no ambiente de desenvolvimento (Docker Linux amd64, mesma máquina):

| Verificação                                    | Antes      | Depois   |
| ---------------------------------------------- | ---------- | -------- |
| Build com dependências em cache                | 76,9 s     | 19,2 s   |
| Tamanho da imagem da aplicação, sem compressão | 366,8 MB   | 127,6 MB |
| `up --build --wait` com cache disponível       | não medido | 17–21 s  |

Esses valores não garantem o tempo de outra máquina. A primeira execução ou uma troca de dependências ainda precisa baixar pacotes: durante o diagnóstico, uma instalação sem cache levou cerca de 110 segundos apenas nessa etapa. O cache passa a beneficiar as próximas execuções no mesmo builder. Caches de diretórios não são automaticamente compartilhados entre máquinas.

O health check verifica disponibilidade a cada cinco segundos, evitando esperar até trinta segundos para o proxy reconhecer que o app já iniciou. Configuração, certificado, banco e migrações continuam sendo verificados; produção continua sem aplicar migrações automaticamente.

Para separar o tempo de compilação do tempo de inicialização:

```sh
docker compose --progress plain build
docker compose up -d --wait
docker compose logs init
```

Não compartilhe `.env`, certificados nem a saída de `docker compose config`, que contém segredos interpolados. Para produção, o [overlay de release](github-actions.md) usa imagens já compiladas no GitHub Actions e evita compilar no servidor.

Referências: [Next.js standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) e [cache de build do Docker](https://docs.docker.com/build/cache/optimize/).

## Desenvolvimento

Copie `.env.example` para `.env`, mantenha `COMPOSE_PROFILES=development` e preencha `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` e as variáveis Keycloak. Configure `APP_URL=http://localhost:3000`. `DATABASE_URL` é ignorada nesse modo Docker, evitando conexão acidental a um banco externo. Usuário, senha e nome do banco local são codificados automaticamente para a URL de conexão; preencha os valores brutos.

O serviço `init` aguarda o banco por tempo limitado. Na primeira subida prepara o schema e a conta; nas demais preserva os usuários e suas senhas. Veja [início rápido](inicio-rapido.md).

## Produção com banco externo

Configure no `.env`:

```env
COMPOSE_PROFILES=production
APP_URL=https://dados.seu-orgao.example
DATABASE_URL=postgresql://USUARIO:SENHA_CODIFICADA@SERVIDOR:5432/BANCO?sslmode=require
BETTER_AUTH_SECRET=SEU_SEGREDO_ALEATORIO_DE_PELO_MENOS_32_CARACTERES
```

Substitua todos os exemplos. A senha na connection string deve ser codificada percentualmente quando necessário. Preserve as opções TLS exigidas pelo servidor; a aplicação não desabilita a verificação TLS nem remove parâmetros da connection string. `POSTGRES_*` não é necessário em produção; `INITIAL_ADMIN_*` deixou de ser utilizado. `localhost` dentro do container é a própria aplicação e não será aceito como banco externo.

Antes da primeira publicação, crie o banco e as permissões no servidor PostgreSQL. Faça backup antes de mudanças relevantes, revise o SQL das migrações e aplique explicitamente:

```sh
docker compose build tools
docker compose run --rm tools db:migrate
```

No Keycloak, atribua o client role `admin` ao responsável, conforme [gestão de acessos](keycloak.md). A conta local será provisionada automaticamente no primeiro login. Não existe senha inicial nem comando de vínculo local.

Depois execute o comando normal de subida. Para verificar sem iniciar a aplicação:

```sh
docker compose build init
docker compose run --rm init
```

A verificação termina com código diferente de zero e orientação de correção quando faltar configuração, conexão, ou migração. Quando Infoconv estiver habilitado, também verifica variáveis, chaves independentes e leitura/formato dos certificados. **Não faz consultas ao SERPRO.** Banco sem schema, permissões insuficientes e divergência de migrações exigem intervenção do operador; não há migração automática em produção.

## Rede, publicação e segredos

A aplicação publica apenas `127.0.0.1:${APP_PORT:-3000}` no host. Configure o proxy reverso com certificado TLS válido encaminhando para essa porta. `APP_URL` deve corresponder à origem HTTPS pública exata. O serviço de banco local não é iniciado em produção; aplicação, verificação e ferramentas possuem rede com saída para o servidor externo.

O pré-deploy verifica acesso do container ao banco e arquivos configurados, mas não comprova o certificado do proxy público, backups ou habilitação contratual. Verifique esses itens antes da publicação. O endpoint `/api/health` confirma somente disponibilidade HTTP.

Credenciais continuam no `.env`, fora do Git e do build. Certificados em `INFOCONV_CERTIFICATES_DIR` são montados somente para leitura. Consulte [Infoconv](infoconv.md) para contrato, limites, retenção e certificados. Desabilitar a fonte permite subir o sistema sem suas credenciais.

## Alternar instalações, atualizar e recuperar

Use instalações, segredos e bancos separados para desenvolvimento e produção. Se reutilizar uma pasta/um projeto Compose para trocar de ambiente, execute `docker compose down` **antes** de alterar o seletor; isso encerra o banco local que já estava em execução, preservando o volume. Depois ajuste as configurações e execute novamente `docker compose up --build -d`. O Compose não migra dados entre bancos.

Para atualizar produção: faça backup, valide a imagem em homologação, revise/aplique migrações pelo serviço `tools` e suba a versão aprovada. Não remova volumes nem use `down -v` como atualização. Em falha, retorne à imagem anterior compatível com o schema ou restaure um backup testado em ambiente isolado.

Defina rotina de backup protegido e teste de restauração conforme a política municipal; evite incluir o conteúdo de `consultation_cache` nos backups para respeitar a retenção de sete dias. Auditoria e logs técnicos permanecem separados. Nunca use produção para testes.
