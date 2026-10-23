# Integração Infoconv e migração do legado

## Contrato utilizado

O adapter reproduz os serviços identificados em `infoconv/include/consulta_cpf_events.php`, `consulta_cnpj_events.php` e nos processadores de lote `api/cpf/pesquisar.php` e `api/cnpj/pesquisar.php` do projeto fornecido.

| Tipo | Método SOAP             | Perfil oficial | Entrada                    |
| ---- | ----------------------- | -------------- | -------------------------- |
| CPF  | `ConsultarCPFPDEC8789`  | CPF 4-WS       | `ListaDeCPF`, `CPFUsuario` |
| CNPJ | `ConsultarCNPJPDEC8789` | CNPJ 6-WS      | `CNPJ`, `CPFUsuario`       |

Os WSDL oficiais foram obtidos em 22/10/2026 com mTLS e validação TLS ativa, sem realizar consultas cadastrais. Cópias públicas dos contratos ficam em `tests/fixtures/`; não contêm certificado ou credenciais. Os serviços e campos foram conferidos com a [documentação dos perfis](https://apicenter.estaleiro.serpro.gov.br/documentacao/infoconv/sistemas/). O CNPJ 6-WS é chamado com um único CNPJ por requisição; o lote da aplicação é uma sequência de consultas individuais.

Os campos são apresentados com sua origem e sem presumir equivalência entre CPF e CNPJ. CNAEs secundários e quadro societário são preservados. Respostas com erro, documento divergente ou estrutura inesperada não entram no cache. O erro SOAP 04 é tratado como cadastro não encontrado, conforme os [códigos oficiais](https://apicenter.estaleiro.serpro.gov.br/documentacao/infoconv/codigos_erro/).

## Configuração e credenciais

As configurações hard coded usadas pela integração foram transferidas para o `.env` local. O certificado continua em arquivo protegido, referenciado por variável de ambiente; nunca deve ficar em `public/`, no Git ou dentro da imagem. Não foram reutilizadas credenciais do MySQL antigo nem senhas de servidores.

| Variável                          | Uso                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `INFOCONV_ENABLED`                | Habilita chamadas reais; padrão `false` em novas instalações                                                     |
| `INFOCONV_CERTIFICATE_PATH`       | Caminho do PEM contendo certificado, cadeia e chave privada                                                      |
| `INFOCONV_CERTIFICATE_PASSPHRASE` | Senha do PEM, quando aplicável                                                                                   |
| `INFOCONV_REQUESTER_CPF`          | Identificação técnica `CPFUsuario` utilizada pelo legado; confirmar sua vinculação ao convênio antes de produção |
| `INFOCONV_CPF_WSDL`               | WSDL oficial CPF, documentado em `.env.example`                                                                  |
| `INFOCONV_CNPJ_WSDL`              | WSDL oficial CNPJ, documentado em `.env.example`                                                                 |
| `INFOCONV_CA_PATH`                | PEM de autoridades certificadoras confiáveis do ambiente                                                         |
| `INFOCONV_CACHE_KEY`              | Chave AES-256: 32 bytes aleatórios, em 64 caracteres hexadecimais                                                |
| `INFOCONV_AUDIT_KEY`              | Chave HMAC independente, no mesmo formato                                                                        |
| `INFOCONV_TIMEOUT_MS`             | Timeout de transporte; padrão 15 segundos                                                                        |
| `INFOCONV_REQUESTS_PER_MINUTE`    | Limite global da aplicação; padrão conservador de 30 tentativas/minuto                                           |
| `INFOCONV_MONTHLY_LIMIT`          | Franquia mensal conjunta CPF/CNPJ: 10.000, conforme contrato informado                                           |
| `INFOCONV_MONTHLY_LIMIT_CPF`      | Teto mensal específico de CPF, se houver                                                                         |
| `INFOCONV_MONTHLY_LIMIT_CNPJ`     | Teto mensal específico de CNPJ, se houver                                                                        |
| `INFOCONV_CERTIFICATE_HOST_PATH`  | Arquivo PEM no host Docker                                                                                       |
| `INFOCONV_CA_HOST_PATH`           | Cadeia de CAs no host Docker                                                                                     |

A franquia informada é de **10.000 consultas mensais**, compartilhadas entre CPF e CNPJ. Ao atingir a franquia, novas chamadas ao SERPRO ficam bloqueadas até um administrador registrar uma liberação em **Auditoria de consultas → Franquia e liberação de excedente**. É necessário informar o total de consultas extras autorizado para o mês, uma justificativa e confirmar ciência da cobrança adicional. A liberação não é cumulativa: informar 200 substitui o total extra anterior por 200. Zero revoga o excedente para novas chamadas, sem desfazer chamadas já realizadas. O histórico preserva responsável, data, mês, quantidade e justificativa. A autorização expira automaticamente no mês seguinte; o cache válido continua acessível mesmo após atingir o teto.

A contagem utiliza mês civil UTC e é compartilhada entre instâncias por bloqueio transacional. Os contadores cobrem tentativas desta aplicação, inclusive falhas cujo faturamento não pode ser determinado localmente. Não incluem consumo do legado ou de outros sistemas; use o extrato do SERPRO para controlar o saldo compartilhado do contrato. Configure a franquia local considerando esse saldo, especialmente no mês da migração.

Gere as duas chaves de forma independente com `randomBytes(32).toString('hex')`, salvando diretamente no gerenciador de segredos ou `.env`, sem imprimir. A troca da chave de cache exige invalidar as entradas antigas; a chave HMAC deve ser preservada para manter a correlação de identificadores da auditoria. Não exponha essas variáveis com `NEXT_PUBLIC_`.

O certificado foi verificado apenas para conectividade e leitura dos contratos. A habilitação do IP de saída, perfil, identificação técnica e condições comerciais continuam sendo as do convênio municipal. A [documentação de configuração do SERPRO](https://apicenter.estaleiro.serpro.gov.br/documentacao/infoconv/configuracoes/) descreve essas exigências.

### Cadeias de confiança

O runtime precisou das cadeias oficiais disponibilizadas na [documentação de certificação digital](https://apicenter.estaleiro.serpro.gov.br/documentacao/infoconv/certificado/). Para produção, use os certificados da Autoridade Certificadora Raiz Brasileira v10 e da Autoridade Certificadora do SERPRO SSLv1, conforme a referência. Converta os certificados públicos para PEM e forneça o bundle por `INFOCONV_CA_PATH`. Homologação utiliza suas próprias cadeias e não deve reutilizar credenciais de produção.

Não use `rejectUnauthorized=false`, certificados autoassinados indiscriminados ou `NODE_TLS_REJECT_UNAUTHORIZED=0`. O adapter exige HTTPS, host e caminhos oficiais, não segue redirecionamentos e limita o tamanho das respostas. Não habilite `DEBUG=node-soap` em ambientes com dados reais: o diagnóstico da biblioteca pode conter XML de consulta. A aplicação retorna erros genéricos e nunca registra o conteúdo dos erros SOAP.

## Cache aprovado: 7 dias, criptografado

A política foi definida nesta tarefa: consultar primeiro a base local e reter respostas válidas por 7 dias, com criptografia. A chave de busca é HMAC do documento, tipo, fonte e perfil; a resposta é criptografada com AES-256-GCM, nonce aleatório e contexto autenticado. O banco não contém o CPF/CNPJ pesquisado em texto puro como chave de consulta.

1. Validar sessão, papel, fonte, documento e finalidade.
2. Adquirir lock transacional por identificador protegido.
3. Consultar cache ainda válido; um acerto não envia requisição ao SERPRO.
4. Sem cache válido, reservar a tentativa respeitando os limites compartilhados entre instâncias e obter os dados via SOAP/mTLS.
5. Validar a resposta e armazená-la criptografada, com data de obtenção e expiração em 7 dias.
6. Registrar auditoria também nos acessos ao cache e nas falhas operacionais.

O lock impede que consultas simultâneas ao mesmo documento gerem chamadas duplicadas. Apenas administradores podem ignorar o cache com atualização forçada. A expiração não é prorrogada quando o cache é consultado. Falhas e dados fictícios não são armazenados como respostas oficiais. Falhas de autenticação do cache são apresentadas como indisponibilidade, sem realizar automaticamente outra consulta cobrável.

Entradas expiradas ficam imediatamente indisponíveis. A limpeza física roda na inicialização, a cada minuto enquanto a aplicação está ativa e antes de consultas. O comando `bun run cache:purge` permite executar a mesma limpeza por um agendador de infraestrutura; ele deve permanecer programado em produção para cobrir períodos em que a aplicação estiver parada. Uma instalação desligada não consegue executar sua própria rotina de limpeza.

Backups regulares devem excluir o conteúdo de `public.consultation_cache`, por exemplo com `pg_dump --exclude-table-data=public.consultation_cache`. O cache é reconstruível e não deve prolongar a retenção por meio de backups. Após restauração, execute a limpeza antes de liberar acesso. Proteja as chaves separadamente do banco e monitore o evento `cache.purge_failed`.

## Fluxos e paridade funcional

| Legado                       | Implementação neste projeto                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login e logout               | Better Auth, sessão individual e revogação no servidor                                                                                                            |
| Troca de senha               | `/account`, exige senha atual e encerra outras sessões                                                                                                            |
| Pesquisa CPF e CNPJ          | `/consultations`, valida dígitos e finalidade; aceita CNPJ alfanumérico conforme o algoritmo oficial                                                              |
| Dados de pessoa física       | Campos do perfil CPF 4-WS, origem e data de obtenção                                                                                                              |
| Dados de pessoa jurídica     | Perfil CNPJ 6-WS, CNAEs secundários e quadro societário                                                                                                           |
| Link Receita Federal         | Link externo identificado, sem credenciais ou sessão na URL                                                                                                       |
| Lotes TXT                    | Um documento por linha, até 500 documentos e 64 KB; remove duplicados                                                                                             |
| Progresso e falhas por item  | Resultados progressivos, interrupção e retomada por reenvio do lote                                                                                               |
| Exportação de planilha       | CSV UTF-8, compatível com Excel, preserva documentos como texto e neutraliza fórmulas; sem falso arquivo XLS contendo HTML                                        |
| Impressão / PDF              | Layout de impressão do navegador; salvar como PDF pela caixa de impressão                                                                                         |
| Histórico completo           | Substituído pela política aprovada: auditoria sem respostas e cache criptografado válido por 7 dias                                                               |
| Editar respostas oficiais    | Substituído por atualização autorizada na fonte; dados oficiais não são alterados manualmente                                                                     |
| Servidores e administração   | `/admin/users`: cadastro, edição, papéis, ativação/desativação, senha, importação/exportação CSV e impressão                                                      |
| Importação de servidores     | `name;email;role`, até 100 por arquivo. Contas novas começam desativadas, sem reutilizar senhas antigas; definir senha individual e ativar no painel              |
| Grupos/permissões            | RBAC explícito: visualizador, operador e administrador; negar acesso por padrão                                                                                   |
| Chaves / tipos de chave      | `/admin/references`: cadastro, edição, exclusão com vínculos protegidos, importação/exportação CSV e impressão                                                    |
| Tabelas auxiliares do legado | `bun run references:seed --actor-id UUID_DO_ADMINISTRADOR` importa 142 códigos não pessoais extraídos das tabelas `chaves`; não copia o dump nem suas credenciais |
| Auditoria                    | Registros separados de diagnóstico, com usuário, finalidade, documento protegido, lote, correlação, origem e resultado                                            |

As tabelas de chaves do legado são cadastros de domínios municipais, não senhas de integração. Seus rótulos são preservados sem associá-los automaticamente aos códigos do SERPRO, que podem ter outro significado. Não foram copiados frameworks gerados, plugins antigos, logs históricos ou dumps de dados pessoais.

O limite por minuto pausa o lote por 60 segundos e permite cancelamento; teto mensal encerra o processamento com mensagem específica, mantendo cache acessível. Três falhas consecutivas interrompem o lote para evitar chamadas repetidas durante indisponibilidade. Interromper não desfaz uma consulta já enviada; seu resultado pode entrar no cache e ser reutilizado ao reenviar o lote.

Exportações e impressões exigem permissão no servidor e são auditadas. Os resultados possuem assinatura HMAC; alterações no navegador ou referências a consultas de outro usuário não autorizam exportação. Arquivos baixados e impressos ficam sob responsabilidade do servidor municipal, fora da retenção automática do cache.

## Banco e deploy

As migrações `0001_panoramic_gargoyle.sql`, `0002_clean_big_bertha.sql` e `0003_wandering_emma_frost.sql` acrescentam cache, auditoria de consultas, domínios, papel `operator`, identificação do ator em alterações administrativas e constraint que limita a retenção a sete dias e histórico de liberações de excedente mensal. Migrações anteriores foram preservadas. Faça backup antes de aplicar:

```sh
bun install --frozen-lockfile
bun run db:migrate
bun run references:seed --actor-id UUID_DO_ADMINISTRADOR
```

As migrações são executadas separadamente do startup. O seed exige o UUID explícito de um administrador ativo para vincular a importação à auditoria; a identificação do operador de console depende dos controles do host.

Para Docker, configurar os caminhos do host e montar os certificados somente para leitura:

```sh
docker compose -f compose.yml -f compose.infoconv.yml up --build -d
```

Use `compose.dev.yml` apenas para banco local; nunca publique PostgreSQL na rede de produção. Configure APP_URL HTTPS, proxy de confiança, políticas de retenção da auditoria, backups sem cache e agendamento da limpeza. Certificados, chaves e `.env` não entram na imagem. Nenhuma senha do legado está na pull request.

## Validação

Testes unitários cobrem contratos, validação documental, criptografia, adulteração, validade de cache, atualização forçada, exportação e erros. O teste SOAP usa os WSDL oficiais contra servidor HTTP exclusivamente local com dados fictícios. O Playwright usa PostgreSQL local isolado com sufixo `_test` e adapter fictício, sem certificado real e sem chamadas cadastrais ao SERPRO.

O único acesso autenticado ao serviço oficial durante o desenvolvimento foi a obtenção dos WSDL. Consultas reais de CPF/CNPJ não são usadas como teste para evitar consumo desnecessário e exposição de dados pessoais.
