# Contribuindo

Descreva problemas e propostas em issues com passos reproduzíveis e dados fictícios. Nunca publique credenciais, certificados ou dados cadastrais. Para vulnerabilidades, consulte [SECURITY.md](SECURITY.md).

Faça um fork, crie uma branch e envie um pull request com problema, solução e validação. Respeite [AGENTS.md](AGENTS.md): MVC modular, TypeScript strict, Bun e integrações independentes. Justifique novas dependências e atualize a documentação.

Para desenvolver fora do container, instale Bun 1.4.4, execute `bun install --frozen-lockfile`, configure `.env` e inicie o banco com `docker compose -f compose.yml -f compose.dev.yml up -d db`. Configure `DATABASE_URL` na porta 55432, aplique `bun run db:migrate` e execute `bun run dev`.

Antes do pull request execute `bun run lint`, `bun run typecheck`, `bun test`, `bun run build` e `bun run format:check`. Informe verificações não executadas. Integrações externas devem usar mocks; confira [testes](docs/testes.md).
