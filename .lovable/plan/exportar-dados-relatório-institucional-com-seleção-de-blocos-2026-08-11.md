# Exportar dados: relatório institucional com seleção de blocos

O diálogo atual gera um PDF simples (tabelas em Helvetica, sem capa, sem identidade) e não deixa escolher o conteúdo. O relatório antigo (o PDF que você anexou) tinha capa vinho com gradiente, títulos de seção, cards de KPI, tabelas zebradas e rodapé "Gerado em … / Página X de Y" — e o usuário escolhia quais módulos entravam. Vamos recuperar essa qualidade e ampliar.

O gerador antigo (`src/utils/institutionalReportPdf.ts` + `ExportReportDrawer.tsx`) foi apagado junto com a rota `/gestor/visao-institucional`, mas está recuperável no histórico do repositório e serve de base visual.

## Como fica a experiência

Clicar em "Exportar dados" no Início abre um painel lateral (não mais um diálogo pequeno), em três passos numa única tela:

```text
1. Formato        [ PDF ]  [ Excel (XLSX) ]
2. O que entra    [x] Indicadores do recorte
                  [x] Evolução institucional
                  [x] Acerto por grande área
                  [x] Distribuição de alunos
                  [ ] Proficiência por semestre
                  [ ] Especialidades e temas        (só com simulado selecionado)
                  [ ] Questões do simulado          (só com simulado selecionado)
                  [ ] Lista de alunos  ⚠ dados pessoais
3. Resumo         Funepe · 6º ano · 3 simulados no recorte
                  4 blocos · ~6 páginas
                  [ Gerar relatório ]
```

- Atalhos "Selecionar tudo" e "Só o essencial" (os 4 primeiros).
- Cada bloco mostra em uma linha o que traz e fica desativado, com motivo, quando não há dado no recorte ("sem simulado com TRI processado", "nenhum simulado selecionado").
- O bloco "Lista de alunos" vem desmarcado, com selo de aviso; ao marcar, aparece a nota de LGPD: arquivo com dados pessoais, uso restrito à coordenação, não redistribuir. A nota também é impressa no rodapé da seção no PDF.
- Botão desabilitado com zero blocos. Durante a geração, estado "Montando relatório…"; ao terminar, confirmação com o nome do arquivo e opção de gerar o outro formato sem refazer as escolhas.
- Os dados são carregados em background quando o painel abre, então clicar em "Gerar" é instantâneo.
- Mobile: mesmo painel, ocupando a tela inteira, com o botão fixo embaixo.

## Como fica o PDF

- **Capa**: fundo vinho em gradiente, "Relatório de Desempenho Institucional", nome da instituição, recorte (ex.: "6º ano"), simulados incluídos, data por extenso e a lista de filtros aplicados — com o **nome** da instituição e dos simulados, não o UUID como no arquivo antigo.
- **Sumário** listando os blocos escolhidos (só quando há 3+ blocos).
- **Seções**: título vinho com régua, cards de KPI em duas colunas, tabelas com cabeçalho cinza e linhas zebradas, números alinhados à direita, badges de classificação (Excelente / Mediano / Crítico) nas cores do portal.
- **Rodapé** em toda página: "Gerado em dd/MM/yyyy às HH:mm" à esquerda, "Página X de Y" à direita.
- Ausência de dado sai como travessão, nunca zero. Cabeçalho de tabela se repete quando a tabela quebra de página.

## Como fica o XLSX

Uma aba por bloco escolhido, mais uma aba "Sobre o relatório" (instituição, recorte, simulados, data, blocos incluídos, aviso de LGPD quando houver alunos). Cabeçalho congelado, larguras ajustadas, formato numérico por coluna, célula vazia onde não há dado.

## Detalhes técnicos

- `src/features/gestor/lib/relatorioPdf.ts` (novo): motor de desenho — capa com gradiente, `secaoTitulo`, `cardsKpi`, `tabela` com zebra/quebra/repetição de cabeçalho, rodapé paginado. Adaptado do `institutionalReportPdf.ts` recuperado de `e84efb5d^`, com as cores lidas dos tokens `--gp-*`.
- `src/features/gestor/lib/exportarRecorte.ts`: passa a receber `blocos: BlocoExport[]` e a montar PDF/XLSX apenas com os blocos pedidos; mantém os helpers de formatação e a regra de traço/célula vazia.
- `src/features/gestor/components/DialogExportarDados.tsx`: reescrito como `Sheet` (padrão dos outros drawers do portal), com `Checkbox`, atalhos de seleção, resumo e estados de carregando/erro/gerando.
- Fontes de dado, todas já existentes e escopadas no servidor: `useVisaoGeral` (indicadores, evolução, áreas, distribuição), `useDetalhamento` (proficiência por semestre, TRI, especialidades/temas), `useQuestoes` e `useAlunos` (lista nominal). Nenhuma RPC nova.
- Blocos que dependem de simulado usam a seleção atual do filtro; nada de "todos os simulados" implícito.
- Gate: o cartão e o painel continuam atrás de `podeExportar`; o bloco de alunos exige o mesmo gate.
- Testes: unidade para a seleção de blocos (nenhum bloco → botão travado; bloco sem dado → desativado) e para o nome de arquivo; e um teste do montador garantindo que bloco não escolhido não aparece no arquivo.
