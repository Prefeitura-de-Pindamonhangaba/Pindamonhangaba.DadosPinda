# Fundação e arquitetura

## Contexto

O repositório iniciou sem aplicação. A fase 1 estabelece roteamento, apresentação institucional, configuração de ambiente, cliente PostgreSQL/Drizzle, qualidade e containers.

## Decisão

Manter um monólito MVC modular. `src/app` contém roteamento e layout. Os módulos `auth`, `users`, `consultations`, `reference-data` e `data-sources/infoconv` separam controllers, serviços, repositories, schemas e views. A composição de dependências do servidor fica em `shared/lib`. A auditoria de identidade e a de consultas têm tabelas independentes de logs técnicos.

O cliente de banco é exclusivo do servidor e reutiliza conexão por processo. Zod valida configurações no momento de uso, com falha explícita e sem incluir valores secretos nos erros. O build não exige conexão ao banco; a área interna exige sessão válida em PostgreSQL.

Os schemas ficam em `modules/<modulo>/models/*-schema.ts`. A primeira migração contém usuários, contas, sessões, verificações, limites de requisições e auditoria. Gerar alterações com `bun run db:generate`, revisar SQL e versionar `drizzle/`. Aplicar com `bun run db:migrate` em etapa controlada.

## Justificativa e consequências

O runtime mínimo adotado é Bun 1.4.4, também fixado no Docker e em `packageManager`. O Bun 1.3.1 apresentou falha interna ao carregar módulos CommonJS no build de produção do Next.js 16.4.2.

A estrutura cresce conforme os casos de uso. Better Auth fornece autenticação consolidada e adapter Drizzle. O pacote `soap` foi acrescentado para interpretar os WSDL oficiais e serializar SOAP sem inventar contratos; seu transporte exige mTLS, valida TLS e restringe endpoints. O wrapper de autenticação permite acrescentar SSO posteriormente. Ver [autenticação](autenticacao.md) e [integração Infoconv](infoconv.md).

## Cache de consultas

O usuário definiu reutilização da base antes de chamar o SERPRO, com respostas criptografadas retidas por 7 dias. Foi adotado AES-256-GCM para conteúdo e HMAC com chave independente para busca/auditoria. Locks transacionais evitam chamadas duplicadas para o mesmo documento e coordenam limites de consumo entre instâncias. Cache expirado não é retornado. Auditoria registra a finalidade e o resultado operacional sem reproduzir a resposta.

Essa decisão reduz consumo, mas significa que o resultado pode refletir a data de obtenção dentro da validade de sete dias. A interface mostra essa data e a origem. Administradores podem solicitar atualização forçada. Resultados oficiais são imutáveis; correções exigem nova consulta na fonte. A limpeza é executada na aplicação e deve ter agendamento externo em produção para períodos de indisponibilidade.

## Identidade visual

Tokens copiados da [referência oficial](https://dsiapp.pindamonhangaba.sp.gov.br/paleta-prefeitura/), consultada em 22/10/2026 via HTTPS. Incluem as cores institucionais e os neutros definidos na referência. A interface prioriza azul para textos, verde para marca e amarelo para sinalização; fonte de sistema para evitar dependência de serviços externos durante build e navegação.

## Controle de excedente contratado

A franquia conjunta de 10.000 chamadas mensais é bloqueada por padrão. Liberações administrativas de quantidade extra são registros imutáveis por mês UTC, com justificativa, responsável e ciência explícita da cobrança adicional. A liberação mais recente substitui o total extra anterior, inclusive zero para revogação. O mesmo lock transacional global serializa liberações e reservas de consultas. No mês seguinte não há saldo extra herdado. Cache não consome franquia.

## Decisão: transporte Infoconv substituível

Contexto: há previsão de substituir o Web Service SOAP por API REST. A configuração e o parser de respostas estavam misturados com o contrato usado pelas consultas e pelo cache.

Decisão: manter `DataSourceAdapter` como contrato de entrada do serviço, centralizar a seleção na factory e colocar toda a implementação SOAP em `data-sources/infoconv/transports/soap`. O contrato normalizado e a configuração comum permanecem fora do protocolo.

Justificativa: a troca de protocolo deve afetar a fonte de dados, preservando autorização, auditoria, franquia, cache e apresentação. Importações específicas são carregadas apenas no ramo selecionado.

Consequências: SOAP continua sendo o padrão compatível. REST só será aceito após implementação e homologação do contrato oficial; não há endpoints inventados ou fallback entre APIs. A implementação futura exige novo adapter, validação específica e registro na factory. O perfil de dados e o namespace do cache devem ser revisados caso o contrato REST seja diferente.
