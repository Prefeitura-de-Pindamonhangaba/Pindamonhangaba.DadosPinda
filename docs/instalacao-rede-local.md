# Instalacao neste servidor

Destino de acesso: `https://10.0.0.16:3001`.

O arquivo `compose.rede-local.yml` acrescenta o proxy HTTPS e configura a confianca no certificado do Keycloak no runtime Bun. O PostgreSQL permanece na rede interna e usa volume persistente. O seletor `COMPOSE_PROFILES=development` utiliza o banco local e o bootstrap de migracoes; a aplicacao e compilada e executada no runtime de producao com URL HTTPS.

## Certificados

Pasta no host: `/opt/Pindamonhangaba.DadosPinda/certificates`.

- `PESQUISA_DE_CPF_CNPJ.pem`: certificado Infoconv e chave privada criptografada; a senha fica em `INFOCONV_CERTIFICATE_PASSPHRASE` no `.env`.
- `infoconv-ca.pem`: cadeia de confianca da integracao Infoconv.
- `keycloak-ca.pem`: certificado publico usado para confiar no Keycloak.

A pasta e montada somente para leitura em `/run/secrets` no app, no init e nas ferramentas. O certificado privado precisa ser legivel pelo UID 1000 do container; foi aplicado proprietario `1000:0` e modo `640`. Os arquivos de certificado e `.env` sao excluidos do Git e do build.

A configuracao publica do proxy fica em `deploy/nginx/rede-local.conf`. O HTTPS da interface usa os arquivos privados `.local/tls/server.crt` e `.local/tls/server.key`. O certificado e o mesmo certificado local do IP usado no Keycloak e precisa ser confiavel no computador do operador.

## Inicializacao

```sh
docker compose -f compose.yml -f compose.rede-local.yml config --quiet
docker compose -f compose.yml -f compose.rede-local.yml up -d --wait --wait-timeout 300
docker compose -f compose.yml -f compose.rede-local.yml ps -a
```

Neste servidor Linux, o `.env` define `COMPOSE_FILE=compose.yml:compose.rede-local.yml`, permitindo usar `docker compose` sem repetir os arquivos. O overlay e opcional para outras instalacoes. Antes do primeiro deploy, criar `.local/tls`, fornecer `server.crt` e `server.key` e preencher o `.env` privado. O certificado publico do Keycloak deve ser colocado em `certificates/keycloak-ca.pem`.

O Infoconv permanece habilitado conforme solicitado. O pre-deploy valida o PEM e a senha antes de iniciar a aplicacao, sem consultar cadastros reais.

O certificado atualizado foi validado em 28/10/2026, com validade ate 12/06/2027. A chave privada e a senha configurada passaram na verificacao do pre-deploy. O Infoconv permaneceu habilitado; nenhuma consulta real ao SERPRO foi feita durante a validacao.

O banco foi iniciado, as migracoes aplicadas e a conta administradora local foi provisionada. As credenciais estao em `.local/acesso-dadospinda.json` (modo 600). O primeiro `.env` anterior ao deploy foi preservado em `.local/env.before-deploy` (modo 600).

A aplicacao, o banco e o proxy foram iniciados. Foram validados por HTTPS: tela de login, health check, login local, sessao administrativa, acesso a administracao de usuarios e logout. O build, a verificacao TypeScript do build e o lint passaram; os testes unitarios tiveram 49 aprovados, 2 ignorados (exigem banco de testes isolado) e nenhuma falha.

O servico systemd `dadospinda-rede-interna.service` restringe conexoes encaminhadas para a publicacao `10.0.0.16:3001` a origem `10.0.0.0/23`. A regra e reaplicada ao iniciar o Docker. Nao foi feita consulta real ao Infoconv.

Os modelos desse servico ficam em `deploy/rede-interna/`. Revise o IP e a rede antes de usar em outro servidor. Para instalar como root:

```sh
install -m 755 deploy/rede-interna/dadospinda-rede-interna /usr/local/sbin/
install -m 644 deploy/rede-interna/dadospinda-rede-interna.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now dadospinda-rede-interna.service
```

## Keycloak

O `.env` usa o cliente confidencial `PindaDados` no realm `pindamonhangaba`, com issuer `https://10.0.0.16:8081/realms/pindamonhangaba`. O callback exato e `https://10.0.0.16:3001/api/auth/callback/keycloak`, e a origem autorizada e `https://10.0.0.16:3001`. O cliente usa Authorization Code com PKCE S256; implicit flow, direct access grants e service accounts estao desabilitados.

A gestão de acessos passou a ser centralizada no Keycloak: configure os client roles e o mapper no ID token conforme [Keycloak](keycloak.md). Vínculos históricos são preservados, mas não são necessários novos comandos de vinculação. Nomes de usuário não concedem privilégios; os papéis do cliente determinam o acesso. A homologação dessa gestão deve ser repetida na instalação real após a atualização.
