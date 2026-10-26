<p align="center">
  <img src="public/brand/prefeitura-pindamonhangaba.svg" alt="Prefeitura de Pindamonhangaba" width="300" />
</p>

# Pinda Dados

**Consulta e integração de dados cadastrais para a gestão municipal.**

Plataforma desenvolvida pela Prefeitura Municipal de Pindamonhangaba, por meio da Secretaria de Tecnologia, Inovação e Projetos (SETIP) — Departamento de Sistemas de Informação (DSI). Reúne consultas de CPF/CNPJ, controle de acesso e rastreabilidade em um monólito MVC modular.

[Início rápido](docs/inicio-rapido.md) · [Documentação](docs/README.md) · [Como contribuir](CONTRIBUTING.md) · [Segurança](SECURITY.md) · [Reportar problema](https://github.com/Prefeitura-de-Pindamonhangaba/Pindamonhangaba.DadosPinda/issues)

## O que a plataforma oferece

| Recurso                    | Comportamento                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Acesso individual          | Login, sessões protegidas, papéis e permissões verificadas no servidor                         |
| Consultas cadastrais       | CPF/CNPJ individuais e lotes TXT, resultados organizados e descrições dos códigos              |
| Integração Infoconv        | SOAP isolado em adapter; contrato interno preparado para uma futura implementação REST         |
| Reutilização de resultados | Cache criptografado por até sete dias, consultado antes de novas chamadas à fonte              |
| Controle de consumo        | Franquia mensal configurável e liberação administrativa auditada do excedente                  |
| Auditoria                  | Finalidade, usuário, origem, resultado operacional e correlação de cada consulta               |
| Administração              | Contas, acessos e domínios municipais, com importação/exportação e impressão                   |
| Identidade institucional   | Paleta oficial, componentes compartilhados e [guia de reutilização](docs/identidade-visual.md) |

A execução local de login, contas e administração não depende de contratar o SERPRO. **Consultas cadastrais reais exigem convênio/contrato, certificado, habilitação e credenciais próprios.** O código não fornece acesso a bases oficiais nem autoriza consultas de dados pessoais. Testes automatizados usam dados fictícios; REST ainda não está implementado.

## Executar localmente

Requisito: **Docker com Compose**. Copie `.env.example` para `.env` e mantenha `COMPOSE_PROFILES=development` e preencha `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` (segredo aleatório de pelo menos 32 caracteres), `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` (12 a 128 caracteres). O modelo contém apenas configurações públicas, sem credenciais utilizáveis.

```sh
docker compose up --build -d
```

Abra http://localhost:3000 e use a conta definida no `.env`. O Compose inicia o banco, aplica migrações locais e cria a primeira conta administradora. Bancos existentes preservam contas e senhas. Não é necessário instalar Bun ou PostgreSQL na máquina. Consulte o [início rápido](docs/inicio-rapido.md).

Mantenha `INFOCONV_ENABLED=false` até configurar a integração. O `.env` e certificados são ignorados pelo Git e excluídos do build; nunca compartilhe esses arquivos.

Para produção, altere somente o seletor para `COMPOSE_PROFILES=production` e forneça `DATABASE_URL` do banco externo e `APP_URL` HTTPS. O comando de subida continua igual; o PostgreSQL local não é criado. O pré-deploy informa configurações ausentes, falhas de conexão, migrações pendentes e falta de administrador, impedindo o início da aplicação. Prepare migrações e a primeira conta explicitamente conforme [operação](docs/operacao.md).

## Configurar a integração e publicar

- [Infoconv: contrato, certificados, variáveis, limites e SOAP/REST](docs/infoconv.md).
- [Operação: Docker, migrações, atualização e recuperação](docs/operacao.md).
- [Identidade, permissões e administração de contas](docs/autenticacao.md).

Os valores de banco em `.env.example` são exclusivos de desenvolvimento. HTTPS, segredos próprios e procedimentos de backup são necessários em produção. A franquia padrão de **10.000 chamadas/mês** corresponde à instalação original; outros órgãos devem configurá-la conforme seu contrato e consumo compartilhado.

## Desenvolver e contribuir

**Stack:** Next.js App Router · React · TypeScript strict · Bun · PostgreSQL · Drizzle ORM · Zod · Better Auth.

```sh
bun run lint
bun run typecheck
bun test
bun run build
bun run format:check
```

Os testes de navegador exigem banco local isolado e navegador compatível; consulte [testes](docs/testes.md). Para corrigir um problema ou propor uma funcionalidade, veja [CONTRIBUTING.md](CONTRIBUTING.md). Não inclua credenciais, certificados, bancos de dados ou dados pessoais em issues e pull requests.

## Organização do projeto

```text
src/app/                    Rotas e renderização Next.js
src/modules/                Auth, usuários, consultas, auditoria e fontes
src/shared/                 Componentes, tokens e infraestrutura compartilhados
drizzle/                    Migrações versionadas
tests/ e e2e/               Testes unitários, contratos e navegador
docs/                       Instalação, operação e decisões técnicas
```

O fluxo MVC é `Route → Controller → Service → Repository/Adapter`. Consulte a [arquitetura](docs/arquitetura.md) e o [índice da documentação](docs/README.md).

## Licença

Código disponibilizado sob a [licença MIT](LICENSE). Consulte também o [guia de identidade institucional](docs/identidade-visual.md).
