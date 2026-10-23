# Identidade visual — referência inicial Pinda Dados

O Pinda Dados inaugura uma linguagem visual para os sistemas municipais: institucional, reconhecível, acolhedora e apropriada à leitura de dados. Esta implementação é uma referência inicial para avaliação e evolução, sem presumir adoção formal por todos os órgãos.

## Fontes e marca

- [Paleta oficial da Prefeitura](https://dsiapp.pindamonhangaba.sp.gov.br/paleta-prefeitura/), consultada em 23/10/2026.
- [Portal institucional](https://pindamonhangaba.sp.gov.br/), referência para o brasão, identificação da Prefeitura, navegação por faixas e presença das cores institucionais.
- Marca SVG obtida da própria [página da paleta](https://dsiapp.pindamonhangaba.sp.gov.br/paleta-prefeitura/assets/brasao.svg), preservada em `public/brand/prefeitura-pindamonhangaba.svg`. Não redesenhar nem recolorir o brasão.

## Distribuição das cores

| Papel               | Aplicação                                                                         |
| ------------------- | --------------------------------------------------------------------------------- |
| Azul institucional  | Estrutura, navegação, rodapé, títulos, ações principais e áreas de destaque       |
| Verde institucional | Marca do produto, acesso aos serviços, bordas de seção e sinalização de conclusão |
| Azul claro          | Superfícies informativas, cabeçalhos de tabelas e agrupamentos de dados           |
| Amarelo             | Identidade de destaque, página ativa e orientações que merecem atenção            |
| Laranja             | Avisos e controles de consumo, sem indicar erro                                   |
| Vermelho            | Erros e indisponibilidade, sempre acompanhados de texto                           |
| Branco e neutros    | Áreas de leitura, formulários e separação dos conteúdos                           |

As cores de fundo não substituem os rótulos. Um status sempre possui texto; a página ativa também usa `aria-current="page"`. As cores dos títulos de grupos organizam o conteúdo e não atribuem validade aos dados.

## Tokens e componentes

As cores originais permanecem em `src/shared/styles/tokens.css`. Novos componentes devem preferir os papéis semânticos `--color-brand`, `--color-action`, `--color-surface-*`, `--color-control-border` e `--color-focus`. Fundos suaves e hover são derivados da própria paleta com `color-mix`, sem nova paleta de hexadecimais.

- `InstitutionalHeader` e `InstitutionalFooter`: identificação da Prefeitura e da unidade, compartilhados entre login e área interna.
- `PanelNavigation`: navegação com estados de hover, foco e página atual, respeitando as permissões recebidas.
- `PanelShell`: composição comum das páginas internas.
- Tipografia: pilha de sistema centralizada em `--font-family-sans`, sem serviços de fontes externos.
- Controles com raio de 6 px; painéis com 12 px; sombra discreta centralizada. Reutilizar os tokens de raio e sombra.
- Espaçamento em múltiplos de 4 px, com margens e alinhamentos consistentes. Telas de dados mantêm hierarquia clara e usam cores sobretudo nos cabeçalhos, agrupamentos e estados.

O padrão admite mais presença cromática, superfícies e agrupamentos do que a fundação anterior. Evitar gradientes decorativos, excesso de animações ou competir visualmente com informações cadastrais.

## Acessibilidade e adaptação

Textos comuns devem manter contraste mínimo de 4,5:1; textos grandes, 3:1; bordas funcionais dos controles, 3:1. Combinações verificadas: branco/azul 11,12:1; azul/amarelo 5,85:1; vermelho/branco 5,60:1; borda de campo/branco 3,38:1. A marca branca sobre verde tem 4,41:1 e utiliza tipografia grande e em negrito; não reutilizar essa combinação em textos pequenos.

Campos têm rótulos visíveis, foco de teclado destacado e tamanho de interação mínimo de 44 px. Navegação e cabeçalhos se reorganizam em telas pequenas. Tabelas extensas mantêm rolagem dentro do próprio contêiner. A impressão omite cabeçalho, navegação e rodapé e prioriza os dados.

## Reutilização em outros sistemas

Começar pelos tokens semânticos e componentes institucionais, mantendo a marca oficial e a hierarquia visual. O nome do sistema e seu conteúdo podem mudar; os papéis das cores, os estados de interação e a composição institucional devem permanecer coerentes. Novas variações devem ser avaliadas e documentadas aqui antes de se tornarem padrões compartilhados. Não criar pacote independente nem infraestrutura adicional enquanto não houver um segundo projeto consumidor.
