# Produção em AlmaLinux com Nginx

Instalação definida para AlmaLinux, arquitetura amd64, runner na própria VM de produção e Nginx local. O domínio será `dados.pindamonhangaba.sp.gov.br`; o DNS ainda precisa ser publicado. O certificado TLS já existe no servidor. Confirme a versão exata do AlmaLinux antes de instalar ou atualizar pacotes.

## Pastas e variáveis

A pasta proposta para a aplicação é `/opt/pinda-dados`; mantenha o runner em outra pasta e use um usuário próprio para seu serviço. Não coloque a configuração privada no workspace de checkout.

No `.env` privado do servidor, criado com base no modelo:

```env
COMPOSE_PROFILES=production
APP_URL=https://dados.pindamonhangaba.sp.gov.br
APP_PORT=3000
DATABASE_URL=CONNECTION_STRING_DO_POSTGRESQL_EXTERNO
BETTER_AUTH_SECRET=SEGREDO_ALEATORIO_EXCLUSIVO_DE_PELO_MENOS_32_CARACTERES
INFOCONV_ENABLED=false
```

Os dois valores em maiúsculas são marcadores: substitua-os pelos segredos reais somente no servidor. Preserve as demais variáveis necessárias da integração. Mantenha leitura do `.env` restrita ao usuário responsável e ao runner. O banco, os segredos e os certificados de produção devem ser exclusivos desse ambiente.

No GitHub, configure `PRODUCTION_PLATFORM=linux/amd64`, `PRODUCTION_DEPLOY_DIR=/opt/pinda-dados`, `PRODUCTION_COMPOSE_PROJECT=pinda-dados` e `PRODUCTION_URL=https://dados.pindamonhangaba.sp.gov.br`. Mantenha `PRODUCTION_DEPLOY_ENABLED=false` durante a preparação. O cadastro do grupo e do runner segue [GitHub Actions](github-actions.md) e exige administrador da organização.

## Conferência da VM

Estes comandos são de leitura e não exibem credenciais:

```sh
cat /etc/almalinux-release
uname -m
docker --version
docker compose version
nginx -v
getenforce
command -v bash python3 flock realpath
```

O usuário do serviço do runner precisa conseguir executar `docker info`, ler a pasta privada e acessar o servidor PostgreSQL externo. O Compose deve ser 2.24.4 ou posterior. Não é necessário instalar Bun ou Node.js na VM; as ferramentas da aplicação executam em containers.

## Proxy Nginx

O [modelo de configuração](../deploy/nginx/pinda-dados.conf.example) encaminha HTTPS para `127.0.0.1:3000`. Antes de usá-lo, ajuste `ssl_certificate` e `ssl_certificate_key` para os caminhos reais do certificado/cadeia e da chave já existentes. Não copie a chave para o repositório. Se já existe um virtual host para esse domínio, ajuste-o em vez de criar outro conflitante.

Depois de revisar o modelo, instale-o na configuração do Nginx segundo o padrão adotado na VM. Valide antes de recarregar:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

Em SELinux Enforcing, o proxy precisa de permissão para conectar ao upstream. Confira a política existente e, se necessário, habilite a opção documentada para reverse proxy:

```sh
getsebool httpd_can_network_connect
sudo setsebool -P httpd_can_network_connect 1
```

Mantenha SELinux ativo. Para erros de conexão ou leitura de arquivos, investigue as negações e corrija as permissões/contextos da instalação.

Se o Infoconv for habilitado e os certificados forem montados de uma pasta dedicada, como `/opt/pinda-dados/certificates`, atribua o contexto apropriado para leitura por containers. Exemplo para essa pasta específica, com `semanage` instalado:

```sh
sudo semanage fcontext -a -t container_file_t '/opt/pinda-dados/certificates(/.*)?'
sudo restorecon -Rv /opt/pinda-dados/certificates
```

Se já existir uma regra para esse caminho, revise-a e use a alteração apropriada em vez de duplicá-la. Não aplique esse contexto às pastas de certificados do Nginx ou do sistema. Confirme também a permissão de leitura dos arquivos pelo usuário `bun` dos containers; o contexto SELinux não substitui permissões Unix. Os volumes da aplicação permanecem somente para leitura.

## Testar antes do DNS

Depois de a aplicação e o Nginx estarem configurados, é possível testar localmente na VM sem alterar DNS e sem desabilitar a verificação do certificado:

```sh
curl --fail --show-error --resolve dados.pindamonhangaba.sp.gov.br:443:127.0.0.1 https://dados.pindamonhangaba.sp.gov.br/api/health
```

De outra máquina autorizada, substitua `127.0.0.1` pelo IP da VM que atende o HTTPS. Para testar o login no navegador antes do DNS, use uma resolução local temporária do domínio para esse IP, mantendo a origem HTTPS e o certificado válidos.

O certificado deve cobrir o domínio e ter cadeia confiável na máquina de teste. Um certificado wildcard válido para `*.pindamonhangaba.sp.gov.br` também pode cobrir o domínio. Não utilize `curl -k` como validação de produção.

Depois de validar a instalação, publique o registro DNS correspondente ao endereço que deve atender os servidores municipais e confirme resolução, firewall, HTTPS e login. Não crie um registro AAAA sem o atendimento IPv6 correspondente. A porta 3000 continua restrita ao loopback; somente o Nginx recebe o tráfego dos usuários.

O health check confirma HTTP; o login e as permissões ainda precisam ser verificados. O deploy definitivo continua dependendo de banco externo preparado, migrações revisadas, administrador, backup e configuração do runner. Nenhum desses passos executa consultas reais ao SERPRO.

## Referências

- [Red Hat: Nginx como reverse proxy e SELinux](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/deploying_web_servers_and_reverse_proxies/index).
- [Nginx: cabeçalhos e encaminhamento ao upstream](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
