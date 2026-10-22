# Fundação e arquitetura

## Contexto

O repositório iniciou sem aplicação. A fase 1 estabelece roteamento, apresentação institucional, configuração de ambiente, cliente PostgreSQL/Drizzle, qualidade e containers.

## Decisão

Manter um monólito MVC modular. `src/app` contém roteamento e layout; a apresentação inicial fica em `modules/foundation/views`. O módulo `auth` separa controllers HTTP, serviço Better Auth, políticas, schemas e views. O módulo `users` concentra provisionamento e manutenção por console, com repositories. A auditoria de identidade tem tabela independente de logs técnicos.

O cliente de banco é exclusivo do servidor e reutiliza conexão por processo. Zod valida configurações no momento de uso, com falha explícita e sem incluir valores secretos nos erros. O build não exige conexão ao banco; a área interna exige sessão válida em PostgreSQL.

Os schemas ficam em `modules/<modulo>/models/*-schema.ts`. A primeira migração contém usuários, contas, sessões, verificações, limites de requisições e auditoria. Gerar alterações com `bun run db:generate`, revisar SQL e versionar `drizzle/`. Aplicar com `bun run db:migrate` em etapa controlada.

## Justificativa e consequências

O runtime mínimo adotado é Bun 1.4.4, também fixado no Docker e em `packageManager`. O Bun 1.3.1 apresentou falha interna ao carregar módulos CommonJS no build de produção do Next.js 16.4.2.

A estrutura cresce conforme os casos de uso. Better Auth fornece autenticação consolidada e adapter Drizzle, justificando as duas dependências adicionais. Contas locais permitem login sem antecipar um provedor institucional. O wrapper central permite acrescentar SSO posteriormente; não há adapter Infoconv nem endpoints de consulta ativos. Ver [autenticação](autenticacao.md).

## Identidade visual

Tokens copiados da [referência oficial](https://dsiapp.pindamonhangaba.sp.gov.br/paleta-prefeitura/), consultada em 22/10/2026 via HTTPS. Incluem as cores institucionais e os neutros definidos na referência. A interface prioriza azul para textos, verde para marca e amarelo para sinalização; fonte de sistema para evitar dependência de serviços externos durante build e navegação.
