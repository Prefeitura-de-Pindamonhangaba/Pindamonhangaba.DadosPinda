# GitHub Actions e produção

A esteira está preparada para **runner próprio Linux na VM que executa os containers de produção**. Se o runner ficar em outra máquina, configure o acesso ao Docker do destino antes de habilitar o deploy; o script atual utiliza o Docker local do runner.

Para a instalação da Prefeitura em AlmaLinux amd64 com Nginx, consulte o [roteiro específico da VM](almalinux-nginx.md).

## Fluxo

- `CI`: pull requests e pushes na `main`; formatação, lint, testes Bun, build, tipagem e Playwright/Chromium com PostgreSQL isolado. Não utiliza segredos de produção nem runner interno.
- `Produção`: execução manual em **Actions → Produção → Run workflow**, selecionando `main`. Repete CI, constrói as imagens de aplicação e ferramentas e publica no GHCR usando o token temporário do GitHub.
- O deploy permanece **desabilitado por padrão**. Só executa quando a variável de repositório `PRODUCTION_DEPLOY_ENABLED` for `true`, no environment `production` e no runner com os labels `self-hosted`, `Linux` e `pinda-dados-production`.
- A ativação usa digests SHA-256 das imagens geradas pelo mesmo workflow. Não usa `latest` nem compila no servidor. Uma execução por vez; deploy em andamento não é cancelado por outro disparo.

Publicar imagens não significa publicar o sistema. O resumo do workflow informa quando a etapa de servidor está desabilitada.

## Configurar juntos: servidor e runner

Confirme primeiro sistema operacional Linux, arquitetura (`amd64` ou `arm64`), domínio HTTPS e se o runner ficará no próprio host dos containers. Instale Docker, Docker Compose **2.24.4 ou posterior**, Bash, Python 3 e utilitários `flock`/`realpath`. Mantenha o runner atualizado para executar as versões das actions fixadas por SHA.

Na organização, crie um **runner group** chamado `pinda-dados-production`, limitado a este repositório e exclusivamente ao workflow `Prefeitura-de-Pindamonhangaba/Pindamonhangaba.DadosPinda/.github/workflows/production.yml@refs/heads/main`. Permita o acesso do repositório público somente com essa restrição de workflow. Não libere todos os workflows nem a CI de PRs: código de forks não deve executar na máquina que acessa a rede e os segredos de produção.

Cadastre o runner Linux na **organização**, atribua-o a esse grupo e adicione também o label `pinda-dados-production`; siga as instruções atuais em **Settings → Actions → Runners → New self-hosted runner**. Instale como serviço e mantenha-o atualizado. O usuário do runner precisa acessar Docker e a pasta privada da aplicação. O workflow seleciona tanto o grupo quanto os labels.

Se a organização não permitir restringir o grupo ao workflow/referência acima, não cadastre um runner persistente diretamente neste repositório público. Nesse caso, vamos definir juntos uma implantação por repositório privado de operações ou outra solução isolada antes de habilitar a produção. A restrição do environment não substitui a restrição do runner group.

O host precisa alcançar GitHub/GHCR e o PostgreSQL externo. Não é necessário abrir SSH ao GitHub. O proxy HTTPS deve encaminhar para a porta local da aplicação, normalmente `127.0.0.1:3000`.

Provisione uma pasta fora do workspace do runner, por exemplo `/opt/pinda-dados`. Crie nela `.env` a partir do modelo, configure `COMPOSE_PROFILES=production`, `DATABASE_URL` externa, `APP_URL` HTTPS e os segredos. Mantenha o arquivo com permissões restritas (por exemplo, `0600` para seu proprietário, garantindo leitura ao usuário do runner). Guarde certificados em `certificates/` dentro dessa pasta, ou informe caminho absoluto em `INFOCONV_CERTIFICATES_DIR`.

Credenciais e certificados **permanecem no servidor**; não são copiados para checkout, artefatos, imagens ou logs. Não cole senhas, connection strings ou chaves privadas no chat. O workflow usa `GITHUB_TOKEN` apenas para publicar/baixar imagens, com permissões limitadas por job, e encerra o login no registry ao finalizar.

## Configurar o repositório

Em **Settings → Environments**, crie `production` e limite deployments à branch `main`. Configure os responsáveis pela aprovação conforme a política da equipe. Essa restrição é importante: a verificação de branch no YAML não substitui a proteção do environment.

Em **Settings → Secrets and variables → Actions → Variables**, configure variáveis de **repositório** (não apenas de environment):

| Nome                         | Valor                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `PRODUCTION_DEPLOY_ENABLED`  | Inicialmente `false`; mudar para `true` somente após preparar o servidor                            |
| `PRODUCTION_DEPLOY_DIR`      | Pasta absoluta provisionada no servidor; exemplo `/opt/pinda-dados`                                 |
| `PRODUCTION_URL`             | URL HTTPS pública, usada na identificação do environment; não substitui APP_URL no .env do servidor |
| `PRODUCTION_PLATFORM`        | `linux/amd64` (padrão) ou `linux/arm64`; deve corresponder ao runner de produção                    |
| `PRODUCTION_COMPOSE_PROJECT` | Nome estável da instalação, padrão `pinda-dados`                                                    |

A compilação usa runner hospedado no GitHub compatível com a arquitetura escolhida. O workflow suporta imagens Linux amd64 e arm64; só é construída a arquitetura selecionada.

Verifique em **Settings → Actions → General** se Actions e as actions oficiais utilizadas estão permitidas. O job de publicação precisa de `packages: write`; o job de deploy utiliza `packages: read`. Se a organização restringir criação/acesso a packages, ajuste essa política. O package publicado deve permitir acesso ao repositório para que seu `GITHUB_TOKEN` possa baixar as imagens. A visibilidade inicial do package não é alterada automaticamente pelo código.

## Primeira publicação

1. Mescle a PR da esteira e confira a CI da `main`.
2. Mantenha `PRODUCTION_DEPLOY_ENABLED=false` e execute manualmente `Produção` na `main` para publicar as imagens.
3. Na pasta provisionada do servidor, coloque os arquivos `compose.yml` e `compose.release.yml` da mesma revisão e um arquivo privado de referências `images.env` contendo `APP_IMAGE=ghcr.io/...@sha256:...` e `TOOLS_IMAGE=ghcr.io/...@sha256:...`. Os digests aparecem no resumo e nos steps de build/publicação do workflow; os nomes das tags incluem `sha-COMMIT` e `tools-sha-COMMIT`.
4. Autentique o operador no GHCR quando o package for privado. Em seguida revise/aplique migrações e defina o primeiro administrador no Keycloak conforme [operação](operacao.md), usando os comandos abaixo com imagens publicadas.
5. Confirme proxy TLS, DNS, conectividade, backup e certificados. Habilite `PRODUCTION_DEPLOY_ENABLED=true` e execute novamente `Produção` na `main`.

Na pasta do servidor, com `.env`, `images.env` e os dois arquivos Compose:

```sh
docker compose --env-file .env --env-file images.env -f compose.yml -f compose.release.yml pull app init tools
docker compose --env-file .env --env-file images.env -f compose.yml -f compose.release.yml run --rm tools db:migrate
docker compose --env-file .env --env-file images.env -f compose.yml -f compose.release.yml run --rm init
```

Use o mesmo `--project-name` configurado em `PRODUCTION_COMPOSE_PROJECT` ao operar uma instalação existente. O deploy nunca aplica migrações automaticamente. Se a pré-verificação reprovar, a aplicação anterior não é substituída.

## Diagnóstico e recuperação

O script registra os arquivos Compose e referências imutáveis em `DEPLOY_DIR/releases/COMMIT-EXECUCAO-TENTATIVA/`. Depois de a aplicação ficar saudável, atualiza `DEPLOY_DIR/current-release`. A trava `.deploy.lock` também impede duas ativações manuais simultâneas.

O health check confirma HTTP dentro do container; valide separadamente a URL pública, o certificado TLS e o acesso dos usuários. Se a ativação falhar, o workflow falha e mantém o registro da última release aprovada; não há restauração automática de banco ou rollback automático de aplicação.

Para recuperar, selecione uma release anterior conhecida e compatível com o schema atual, utilize seus arquivos Compose e `images.env`, o `.env` privado atual e o mesmo nome de projeto. Execute pré-verificação e subida com imagens publicadas. Se a versão antiga não for compatível com as migrações já aplicadas, siga o plano de recuperação do banco após avaliar backup/restauração. Não execute `down -v`, `prune`, migração destrutiva ou remoção de releases como atualização.

## Referências

- [GitHub: publicação de imagens Docker](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
- [GitHub: environments e regras de implantação](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
- [GitHub: uso seguro de Actions](https://docs.github.com/en/actions/reference/security/secure-use).

- [GitHub: restringir acesso a grupos de runners](https://docs.github.com/en/enterprise-cloud@latest/actions/how-tos/manage-runners/self-hosted-runners/manage-access).
