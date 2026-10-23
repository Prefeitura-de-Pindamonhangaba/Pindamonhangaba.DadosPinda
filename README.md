# Pinda Dados

Plataforma interna da Prefeitura Municipal de Pindamonhangaba, mantida pela SETIP / DSI.

Monólito MVC modular em Next.js App Router, TypeScript strict e Bun. Login individual, consultas Infoconv de CPF/CNPJ, lotes TXT, cache criptografado por 7 dias, auditoria e administração de acessos.

## Desenvolvimento

Requisito: Bun 1.4.4 ou compatível.

```powershell
Copy-Item .env.example .env
bun install --frozen-lockfile
# Configure APP_URL, DATABASE_URL e BETTER_AUTH_SECRET no .env.
docker compose -f compose.yml -f compose.dev.yml up -d db
bun run db:migrate
# Provisione uma conta conforme docs/autenticacao.md.
# Para Infoconv, configure as variáveis e certificados em docs/infoconv.md.
bun run references:seed --actor-id UUID_DO_ADMINISTRADOR
bun run dev
```

Acesse a URL configurada em `APP_URL`. O login exige PostgreSQL e migrações aplicadas. O override de desenvolvimento publica o banco somente em `127.0.0.1:55432`; ajuste `DATABASE_URL` para essa porta.

```sh
bun run lint
bun run typecheck
bun test
bun run build
bun run format:check
```

Consulte [integração Infoconv e paridade com o legado](docs/infoconv.md), [autenticação e contas](docs/autenticacao.md), [arquitetura](docs/arquitetura.md) e [configuração e operação](docs/operacao.md).

A [referência inicial de identidade visual](docs/identidade-visual.md) registra os papéis da paleta oficial, componentes institucionais e orientações para manter coerência entre sistemas municipais.
