# Testes

Com Bun 1.4.4, instale as dependências usando `bun install --frozen-lockfile`. Execute:

```sh
bun run lint
bun run typecheck
bun test
bun run build
bun run format:check
```

Os testes Bun usam dados fictícios e mocks, sem consultas cadastrais reais. Os testes Playwright em `e2e/` exigem Microsoft Edge e banco isolado conforme `playwright.config.ts`. Confira a configuração antes de executar `bun run test:e2e`. Nunca utilize banco de produção ou dados que devam ser preservados.

Na CI, Playwright usa Chromium instalado pelo workflow e PostgreSQL efêmero com banco exclusivo. `PLAYWRIGHT_BROWSER_CHANNEL=chromium` seleciona esse navegador; sem a variável permanece o Edge local. O workflow não usa certificados ou dados reais.

Os testes de certificados Infoconv geram identidades fictícias temporárias com `openssl` (disponível no PATH do ambiente de testes) e verificam mTLS em loopback. O binário é necessário somente para gerar as fixtures de teste; o carregamento de PFX/PEM na aplicação usa o TLS nativo do Bun, sem OpenSSL externo em produção e sem consultas ao SERPRO.
