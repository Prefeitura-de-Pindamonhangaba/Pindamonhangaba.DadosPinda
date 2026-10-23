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
