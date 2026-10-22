# AGENTS.md — Pinda Dados

## 1. Identidade e objetivo

**Projeto:** Pinda Dados  
**Organização:** Prefeitura Municipal de Pindamonhangaba  
**Área responsável:** Secretaria de Tecnologia, Inovação e Projetos (SETIP) — Departamento de Sistemas de Informação (DSI)

O **Pinda Dados** é uma plataforma web interna destinada à consulta e integração de dados cadastrais de pessoas físicas e jurídicas, provenientes de fontes oficiais internas e externas.

O sistema deverá oferecer uma interface única, segura e padronizada para servidores municipais autorizados, especialmente aqueles envolvidos em atividades de fiscalização e gestão cadastral.

### Evolução prevista

- **Fase inicial:** integração com a API Infoconv do SERPRO, para consultas de CPF e CNPJ conforme os serviços contratados.
- **Expansão municipal:** integração com cadastros físicos/imobiliários, mobiliários e de contribuintes da Prefeitura.
- **Expansão futura:** incorporação de outras fontes oficiais, conforme necessidade e autorização.

Cada fonte deverá ser integrada de maneira independente, permitindo a evolução do sistema sem dependência de um fornecedor específico.

### Princípios fundamentais

- Simplicidade e legibilidade.
- Monólito MVC modular.
- Separação clara de responsabilidades.
- Segurança e privacidade desde o início.
- Desenvolvimento incremental.
- Baixo acoplamento entre módulos.
- Reutilização de componentes.
- Facilidade de manutenção por uma equipe pequena.
- Preferência por tecnologias abertas.
- Não antecipar funcionalidades futuras.

**Diretriz principal:** construir apenas o necessário para a etapa atual, preservando a capacidade de expansão.

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js — App Router |
| Linguagem | TypeScript strict |
| Runtime | Bun |
| Gerenciador de pacotes | Bun |
| Interface | React |
| Arquitetura | MVC modular |
| Backend | Controllers e Services |
| Banco de dados | PostgreSQL |
| ORM | Drizzle ORM |
| Migrações | Drizzle Kit |
| Validação | Zod |
| Containers | Docker |
| Orquestração | Docker Compose |
| Testes | Bun Test e Playwright |
| Qualidade | ESLint e Prettier |

Utilizar versões estáveis e suportadas.

Não adicionar dependências sem necessidade técnica justificada.

### Regras do Bun

O Bun será utilizado no desenvolvimento, gerenciamento de pacotes, build, testes e execução em produção.

Comandos padrão:

```bash
bun install
bun run dev
bun run build
bun run start
bun test
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

Regras:

1. Não utilizar npm, yarn ou pnpm.
2. Versionar `bun.lock`.
3. Utilizar `bun install --frozen-lockfile` nos builds reproduzíveis.
4. Utilizar imagens oficiais `oven/bun` nos containers.
5. Não instalar Node.js no container por padrão.
6. Verificar compatibilidade das dependências com Bun.
7. Validar o funcionamento da aplicação no container final.

---

## 3. Arquitetura MVC modular

O Pinda Dados será desenvolvido como um **monólito MVC modular**, utilizando o Next.js para roteamento e renderização.

As responsabilidades deverão permanecer separadas.

### Model

Responsável pela representação e persistência dos dados.

Inclui:

- Schemas do Drizzle ORM.
- Entidades e tipos.
- Repositories.
- Consultas e operações de persistência.

### View

Responsável exclusivamente pela apresentação.

Inclui:

- Páginas React.
- Formulários.
- Tabelas.
- Componentes de interface.
- Estados visuais.

Views não devem implementar regras de negócio nem acessar diretamente o banco.

### Controller

Responsável por receber e coordenar requisições.

Inclui:

- Recebimento de parâmetros.
- Validação de entradas com Zod.
- Verificação de autenticação e autorização.
- Chamada dos services.
- Tratamento e formatação das respostas.

Controllers não devem acessar repositories diretamente nem implementar regras complexas de negócio.

### Service

Responsável pela lógica de negócio.

Inclui:

- Regras de domínio.
- Coordenação de repositories.
- Orquestração das consultas.
- Integração entre módulos.
- Aplicação de políticas de negócio.
- Transações quando necessárias.

Services não devem depender de componentes React ou objetos HTTP do Next.js.

### Fluxo obrigatório

```text
Next.js Route / Server Action
              |
              v
          Controller
              |
              v
           Service
              |
              v
       Model / Repository
              |
              v
          PostgreSQL
```

Para integrações externas:

```text
Controller
    |
    v
Consultation Service
    |
    v
Data Source Adapter
    |
    v
API / Sistema Externo
```

O Next.js deverá atuar como camada de roteamento, mantendo os arquivos em `app/` mínimos.

---

## 4. Estrutura de diretórios

Estrutura inicial recomendada:

```text
pinda-dados/
├── AGENTS.md
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (panel)/
│   │   │   ├── page.tsx
│   │   │   └── consultations/
│   │   ├── api/
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── consultations/
│   │   ├── audit/
│   │   └── data-sources/
│   │       ├── infoconv/
│   │       └── municipal/
│   │
│   └── shared/
│       ├── components/
│       ├── lib/
│       │   ├── db/
│       │   ├── auth/
│       │   ├── security/
│       │   └── env.ts
│       ├── styles/
│       └── types/
│
├── drizzle/
├── tests/
├── docs/
├── Dockerfile
├── compose.yml
├── drizzle.config.ts
├── next.config.ts
├── .env.example
├── bun.lock
├── tsconfig.json
└── package.json
```

Cada módulo deverá utilizar os diretórios necessários:

```text
module/
├── controllers/
├── services/
├── models/
├── views/
├── schemas/
└── permissions.ts
```

Não criar diretórios vazios apenas para completar a estrutura.

---

## 5. Integrações e fontes de dados

O Pinda Dados deverá permitir múltiplas fontes cadastrais, mantendo suas integrações independentes.

### Regras arquiteturais

1. Cada fonte terá seu próprio módulo ou adapter.
2. A lógica de consulta será coordenada pelo módulo `consultations`.
3. Integrações não deverão depender diretamente umas das outras.
4. Cada adapter será responsável por autenticação externa, comunicação, validação e transformação das respostas.
5. Os dados deverão ser normalizados quando necessário, preservando a origem.
6. A indisponibilidade de uma fonte não deverá comprometer desnecessariamente as demais.
7. Não criar integrações futuras antes de existir demanda concreta.

### Modelo de consulta

O sistema deverá permitir consultas por CPF ou CNPJ, conforme as fontes disponíveis e as permissões do usuário.

Os resultados poderão ser organizados por fonte, com identificação clara da origem das informações.

A consolidação de dados de diferentes fontes deverá preservar diferenças de significado, atualização e confiabilidade. Não presumir que campos semelhantes sejam equivalentes.

---

## 6. Integração Infoconv — SERPRO

O Infoconv será a primeira fonte de dados do Pinda Dados.

Referência oficial:

https://loja.serpro.gov.br/infoconv/product/infoconv

### Requisitos

- Implementar consultas de CPF e CNPJ conforme os serviços efetivamente contratados e documentados.
- Isolar a integração em `modules/data-sources/infoconv`.
- Manter credenciais exclusivamente no backend.
- Validar parâmetros de entrada.
- Validar e tratar respostas da API.
- Implementar timeouts e tratamento de indisponibilidade.
- Não expor tokens, credenciais ou detalhes internos.
- Respeitar limites de utilização e condições contratuais.
- Registrar auditoria das consultas realizadas.

### Restrições

O agente não deverá inventar endpoints, campos, métodos de autenticação ou formatos de resposta.

Antes de implementar a integração real, deverá consultar a documentação técnica disponibilizada pelo SERPRO e confirmar:

- Serviços contratados.
- Endpoints disponíveis.
- Método de autenticação.
- Estrutura das requisições.
- Estrutura das respostas.
- Limites e regras de utilização.
- Requisitos de segurança.

Caso a documentação não esteja disponível, implementar apenas interfaces e contratos internos necessários, utilizando mocks identificados como dados fictícios.

---

## 7. Autenticação e autorização

A autenticação deverá ser centralizada e extensível.

A arquitetura deverá permitir integração futura com:

- Keycloak.
- Active Directory por meio de provedor apropriado.
- OpenID Connect.
- Microsoft Entra ID.

Não implementar autenticação própria do zero quando houver solução consolidada adequada.

### Autorização

Utilizar RBAC, com usuários, papéis e permissões.

Exemplos:

```text
consultations:read
consultations:cpf
consultations:cnpj
sources:infoconv
sources:municipal
audit:read
users:manage
roles:manage
```

As permissões deverão permitir controlar quais usuários podem consultar cada fonte.

A arquitetura também deverá possibilitar restrições futuras por secretaria, departamento, setor ou unidade.

### Regras obrigatórias

1. Negar acesso por padrão.
2. Aplicar o princípio do menor privilégio.
3. Verificar autorização no servidor.
4. Não confiar exclusivamente em controles da interface.
5. Utilizar identificadores internos estáveis para usuários.
6. Não utilizar e-mails como chaves primárias.
7. Proteger sessões e cookies.
8. Não compartilhar credenciais entre usuários.
9. Registrar alterações administrativas relevantes.
10. Preparar a arquitetura para SSO institucional.

---

## 8. Segurança, privacidade e LGPD

O Pinda Dados manipulará dados pessoais e deverá aplicar segurança desde o início.

### Requisitos obrigatórios

- HTTPS em produção.
- Validação de entradas com Zod.
- Consultas parametrizadas ao banco.
- Proteção contra XSS, CSRF e SSRF.
- Proteção de sessões e cookies.
- Limitação de requisições e consultas quando necessário.
- Segredos armazenados fora do código-fonte.
- Tratamento seguro de erros.
- Controle de acesso por usuário e fonte.
- Proteção contra consultas automatizadas não autorizadas.
- Aplicação dos princípios da LGPD.

### Finalidade das consultas

Toda consulta deverá estar vinculada a uma finalidade administrativa legítima e autorizada.

O sistema deverá permitir registrar a justificativa ou finalidade da consulta, conforme política definida pela Prefeitura.

O acesso técnico à ferramenta não representa autorização irrestrita para consultar dados pessoais.

### Armazenamento

Por padrão, o sistema deverá evitar armazenar respostas cadastrais completas.

Persistir apenas os dados necessários para funcionamento, auditoria e obrigações aplicáveis.

A eventual implementação de cache ou histórico de resultados dependerá de decisão explícita sobre necessidade, finalidade, retenção e proteção.

---

## 9. Auditoria

Todas as consultas cadastrais deverão gerar registros de auditoria.

Registrar, conforme a política aplicável:

- Identificador do usuário.
- Data e hora.
- Tipo de consulta.
- Fonte consultada.
- Identificador pesquisado, com proteção adequada.
- Finalidade declarada.
- Resultado operacional.
- Identificador de correlação da operação.

Os registros deverão permitir rastrear o uso do sistema sem reproduzir desnecessariamente os dados retornados pelas fontes.

Não registrar senhas, tokens, respostas completas ou dados pessoais excessivos em logs técnicos.

Auditoria e logs de diagnóstico deverão permanecer separados.

Acesso aos registros de auditoria deverá ser restrito e também controlado.

---

## 10. Banco de dados e migrações

Utilizar PostgreSQL e Drizzle ORM.

### Convenções

- Tabelas e colunas em `snake_case`.
- Propriedades TypeScript em `camelCase`.
- Identificadores preferencialmente UUID.
- Chaves estrangeiras explícitas.
- Constraints no banco.
- Índices conforme necessidade.
- Datas preferencialmente em `timestamptz`.
- Armazenamento temporal consistente, preferencialmente UTC.

### Migrações

1. Utilizar Drizzle Kit.
2. Versionar todas as migrações.
3. Revisar o SQL gerado.
4. Não utilizar `drizzle-kit push` em produção.
5. Não alterar migrações já aplicadas.
6. Não executar operações destrutivas sem autorização.
7. Realizar backup antes de alterações relevantes.
8. Não executar migrações automaticamente em toda inicialização de produção.

---

## 11. Identidade visual

O Pinda Dados deverá seguir a identidade visual institucional da Prefeitura Municipal de Pindamonhangaba.

### Paleta oficial obrigatória

https://dsiapp.pindamonhangaba.sp.gov.br/paleta-prefeitura/

A paleta disponibilizada nesse endereço será a referência oficial de cores da aplicação.

Regras:

1. Consultar a referência antes de definir cores.
2. Não inventar valores hexadecimais.
3. Centralizar cores em design tokens ou variáveis CSS.
4. Evitar cores definidas diretamente nos componentes.
5. Utilizar cores institucionais de maneira consistente.
6. Garantir contraste e acessibilidade.
7. Não criar paletas alternativas sem autorização.
8. Caso a referência esteja indisponível, preservar os tokens existentes e informar a impossibilidade de verificação.

---

## 12. Estilo visual obrigatório

A interface deverá combinar:

**Swiss Design + Minimalismo + Design System Institucional.**

### Swiss Design

Priorizar:

- Grids consistentes.
- Alinhamentos rigorosos.
- Hierarquia tipográfica clara.
- Espaçamento intencional.
- Organização objetiva.
- Composições equilibradas.
- Assimetria controlada quando funcional.

### Minimalismo

Priorizar:

- Interfaces limpas.
- Baixa poluição visual.
- Navegação simples.
- Redução de elementos decorativos.
- Uso moderado de cores.
- Eficiência dos fluxos de trabalho.

Evitar:

- Sombras excessivas.
- Gradientes decorativos.
- Animações desnecessárias.
- Cards sem função.
- Bordas excessivas.
- Elementos visuais que concorram com os dados.

### Design System Institucional

Utilizar:

- Tokens de cores.
- Escala tipográfica consistente.
- Espaçamentos padronizados.
- Componentes reutilizáveis.
- Estados de interação padronizados.
- Ícones consistentes.
- Formulários acessíveis.
- Tabelas organizadas.
- Layouts responsivos.

### Diretriz estética

A interface deverá transmitir uma identidade:

**Institucional, moderna, sóbria, organizada e confiável.**

O objetivo não é reproduzir a aparência de sistemas governamentais antigos nem adotar elementos decorativos típicos de aplicações comerciais.

O design deverá favorecer a produtividade dos servidores e a leitura de informações cadastrais.

---

## 13. Componentes e experiência do usuário

Priorizar componentes compartilhados para:

- Botões.
- Campos de entrada.
- Formulários.
- Tabelas.
- Menus.
- Alertas.
- Modais.
- Indicadores de carregamento.
- Estados vazios.
- Mensagens de erro.

### Consultas cadastrais

A interface de consulta deverá ser simples e objetiva.

Recomendações:

1. Campo de busca claramente identificado.
2. Seleção ou identificação do tipo de documento.
3. Validação antes do envio.
4. Indicação da fonte consultada.
5. Apresentação organizada dos resultados.
6. Feedback de carregamento.
7. Tratamento de ausência de resultados.
8. Mensagens claras em caso de indisponibilidade.
9. Proteção contra exposição indevida de dados.
10. Acessibilidade por teclado e tecnologias assistivas.

Priorizar tabelas e agrupamentos objetivos em vez de múltiplos cards decorativos.

---

## 14. Configuração por ambiente

Suportar:

- Desenvolvimento.
- Testes.
- Produção.

Utilizar variáveis de ambiente e manter `.env.example`.

Exemplo ilustrativo:

```env
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/pinda_dados
APP_URL=http://localhost:3000

# Configurações da integração Infoconv
# Definir conforme documentação oficial.
```

Regras:

1. Nunca versionar credenciais reais.
2. Separar bancos por ambiente.
3. Não utilizar credenciais de produção em desenvolvimento.
4. Validar configurações obrigatórias com Zod.
5. Falhar explicitamente quando configurações essenciais estiverem ausentes.
6. Não expor segredos por variáveis `NEXT_PUBLIC_`.
7. Documentar novas variáveis.

---

## 15. Docker e deploy

Utilizar Docker e Docker Compose.

### Dockerfile

- Utilizar imagem oficial do Bun.
- Fixar versão da imagem.
- Utilizar multi-stage build.
- Instalar dependências com lockfile.
- Executar build no container.
- Reduzir dependências da imagem final.
- Executar com usuário não privilegiado.
- Utilizar Bun como runtime de produção.

### Docker Compose

O ambiente inicial deverá conter:

- Aplicação Next.js.
- PostgreSQL.

Requisitos:

- Persistência do banco.
- Health checks.
- Rede interna.
- Configuração por ambiente.
- Política de reinicialização.
- Banco não exposto publicamente por padrão.

### Produção

Garantir:

- HTTPS.
- Proxy reverso quando necessário.
- Backups.
- Logs.
- Deploy reproduzível.
- Procedimento documentado de atualização.
- Recuperação em caso de falhas.

---

## 16. Convenções de código

Utilizar TypeScript strict.

Evitar `any` e preferir tipos explícitos.

### Nomenclatura

| Elemento | Convenção |
|---|---|
| Variáveis | camelCase |
| Funções | camelCase |
| Componentes | PascalCase |
| Tipos e interfaces | PascalCase |
| Constantes globais | UPPER_SNAKE_CASE |
| Arquivos | kebab-case |
| Diretórios | kebab-case |
| Tabelas | snake_case |
| Colunas | snake_case |

### Idioma

- Código e identificadores em inglês.
- Interface em português brasileiro.
- Documentação em português brasileiro.
- Mensagens apresentadas aos usuários em português brasileiro.

### Boas práticas

- Funções pequenas.
- Responsabilidades claras.
- Baixa duplicação.
- Evitar abstrações prematuras.
- Não criar arquivos excessivamente grandes.
- Preferir legibilidade.
- Comentar decisões relevantes, não comportamentos óbvios.

---

## 17. Tratamento de erros

Distinguir:

- Erros de validação.
- Erros de autenticação.
- Erros de autorização.
- Erros de negócio.
- Erros de integração.
- Erros inesperados.

Controllers deverão converter erros em respostas apropriadas.

Services deverão utilizar erros de domínio sem depender de códigos HTTP.

Não retornar stack traces ou informações sensíveis ao usuário.

Não ocultar falhas silenciosamente.

Falhas de fontes externas deverão ser apresentadas de forma clara, sem expor detalhes internos.

---

## 18. Testes e qualidade

Utilizar Bun Test para testes unitários e de integração.

Utilizar Playwright para testes de ponta a ponta quando necessário.

Priorizar testes de:

- Services.
- Controllers.
- Autorização.
- Validação.
- Repositories.
- Integrações externas.
- Auditoria.
- Operações críticas.

Integrações externas deverão utilizar mocks nos testes automatizados, evitando consultas reais desnecessárias.

Testes de banco deverão utilizar ambientes isolados.

Nunca executar testes contra produção.

### Validação

Antes de concluir alterações relevantes:

```bash
bun run lint
bun run typecheck
bun test
bun run build
```

Os scripts deverão existir no `package.json`.

Não afirmar que testes passaram sem executá-los.

---

## 19. Documentação

Manter documentação objetiva em `docs/`.

Documentar:

- Instalação.
- Configuração.
- Desenvolvimento.
- Integrações.
- Permissões.
- Migrações.
- Deploy.
- Recuperação.
- Decisões arquiteturais relevantes.

Decisões arquiteturais deverão registrar contexto, decisão, justificativa e consequências.

Evitar documentação extensa sem necessidade.

---

## 20. Desenvolvimento incremental

### Fase 1 — Fundação

- Inicializar Next.js com Bun.
- Configurar TypeScript strict.
- Configurar PostgreSQL e Drizzle ORM.
- Configurar Docker.
- Criar estrutura MVC modular.
- Configurar variáveis de ambiente.
- Implementar layout inicial.
- Aplicar a identidade visual institucional.
- Configurar lint, formatação e testes.

### Fase 2 — Identidade e segurança

- Definir solução de autenticação.
- Implementar login e sessões.
- Implementar usuários.
- Implementar RBAC.
- Proteger controllers.
- Implementar auditoria básica.

### Fase 3 — Consultas Infoconv

- Confirmar documentação e serviços contratados.
- Implementar adapter Infoconv.
- Implementar consultas autorizadas de CPF e CNPJ.
- Criar interface de consulta.
- Apresentar resultados por fonte.
- Registrar auditoria.
- Implementar tratamento de falhas.
- Validar permissões e segurança.

### Fase 4 — Expansão

Conforme demanda:

- Cadastro físico/imobiliário municipal.
- Cadastro mobiliário.
- Outras fontes cadastrais.
- Consultas integradas.
- Permissões por unidade organizacional.
- SSO institucional.
- Novas funcionalidades administrativas.

Não antecipar fases sem solicitação.

---

## 21. Instruções obrigatórias para agentes de IA

Todo agente deverá:

1. Ler este documento antes de modificar o projeto.
2. Inspecionar a estrutura existente.
3. Respeitar a arquitetura MVC modular.
4. Utilizar Bun.
5. Respeitar a stack tecnológica.
6. Não introduzir microsserviços.
7. Não adicionar dependências sem justificativa.
8. Não implementar funcionalidades fora do escopo.
9. Manter controllers, services, models e views separados.
10. Não colocar lógica de negócio nas views.
11. Não acessar o banco diretamente nos controllers.
12. Centralizar autenticação e autorização.
13. Isolar integrações externas.
14. Não inventar contratos de APIs.
15. Preservar a origem dos dados.
16. Validar entradas e respostas externas.
17. Proteger credenciais e dados pessoais.
18. Registrar auditoria nas operações sensíveis.
19. Respeitar a LGPD e as finalidades autorizadas.
20. Utilizar a paleta oficial da Prefeitura.
21. Seguir Swiss Design + Minimalismo + Design System Institucional.
22. Reutilizar componentes e tokens existentes.
23. Não executar operações destrutivas sem autorização.
24. Preservar compatibilidade.
25. Atualizar documentação relevante.
26. Executar os testes disponíveis.
27. Informar testes não executados.
28. Comunicar decisões técnicas relevantes.
29. Solicitar esclarecimentos para decisões arquiteturais de alto impacto.

### Antes de implementar

- Entender o requisito.
- Identificar o módulo responsável.
- Verificar os padrões existentes.
- Definir controllers, services, models e views necessários.
- Identificar impactos de segurança e privacidade.
- Escolher a solução mais simples.

### Durante a implementação

- Realizar alterações pequenas.
- Respeitar as camadas.
- Evitar dependências desnecessárias.
- Preservar a identidade visual.
- Manter código legível.
- Não antecipar funcionalidades.

### Após implementar

- Verificar tipagem.
- Executar testes.
- Verificar build.
- Revisar segurança.
- Documentar alterações relevantes.
- Informar limitações e pendências.

---

## 22. Diretriz final

O **Pinda Dados** deverá permanecer um monólito MVC modular, simples, seguro, extensível e sustentável.

A plataforma deverá começar pela integração Infoconv, mas sua arquitetura deverá permitir a incorporação de novas fontes cadastrais sem reestruturações significativas.

O Next.js será responsável pelo roteamento e renderização, enquanto controllers, services, models e views manterão suas responsabilidades separadas.

A interface deverá seguir a identidade institucional da Prefeitura, combinando Swiss Design, Minimalismo e Design System Institucional.

A segurança, a privacidade e a rastreabilidade das consultas deverão ser consideradas requisitos fundamentais, não funcionalidades opcionais.

**Construir o necessário agora, preservando a capacidade de evoluir depois.**
