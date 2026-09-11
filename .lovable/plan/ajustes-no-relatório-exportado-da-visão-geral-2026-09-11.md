# Ajustes no relatório exportado da Visão geral

Quatro correções no arquivo gerado (PDF e planilha), para o documento dizer exatamente o que está sendo medido.

## 1. O arquivo passa a respeitar os simulados escolhidos

Hoje a seleção de simulados no painel de exportação não chega em parte do conteúdo: os indicadores, a evolução e o acerto por área vêm do recorte histórico completo da instituição, independentemente do que foi marcado.

Como fica:

- **Evolução institucional**: passa a listar somente os simulados escolhidos. Sem seleção, continua mostrando todos.
- **Indicadores do recorte**: com simulados escolhidos, o bloco mostra **um conjunto de números por simulado** (participantes, alunos proficientes, acerto médio, conceito ENAMED), nunca uma média única entre simulados diferentes. Sem seleção, continua o painel histórico atual.
- **Acerto por grande área** e **Distribuição de alunos**: continuam históricos (é assim que o dado existe), agora com nota de rodapé dizendo isso com clareza — ver itens 2 e 4.

## 2. Notas de rodapé em "Indicadores do recorte"

Abaixo dos cartões entra um bloco de rodapé explicitando o recorte do arquivo:

- Instituição e recorte de semestre aplicados.
- Simulados considerados (nomes, um a um) ou "todos os simulados com nota do recorte" quando nenhum foi escolhido.
- Qual leitura cada número tem: por simulado quando há seleção, histórico acumulado quando não há.
- Mantém a nota atual de que "—" significa dado não medido.

## 3. "Evolução institucional" passa a mostrar alunos proficientes

A coluna "Proficiência" (média da nota) é substituída por **"Alunos proficientes (%)"** — o mesmo número do indicador do topo, para os dois conversarem. Simulado sem nota TRI continua saindo com "—", nunca zero. Vale para PDF e planilha.

## 4. Nota de rodapé em "Acerto por grande área"

Junto da nota de classificação já existente, entra a explicação de que o percentual de cada grande área é a **média histórica de acerto da instituição naquela área**, somando todos os simulados com resultado do recorte — não o desempenho de um simulado específico.

## Detalhes técnicos

- `lib/exportarRecorte.ts`
  - `DadosExportRecorte` ganha `simuladosIds?: string[]`.
  - `tabelaEvolucao`: filtra `vg.evolucao` por `simuladosIds` quando houver, e troca a coluna de `valor` por `proficientesPct` (já presente em `api/types.ts`).
  - Bloco `indicadores`: quando `simuladosIds` não está vazio e há `detalhamento.metricas`, renderiza uma tabela por simulado (participantes, `proficientesPct`, `acertoMedioPct`, `enamedProjetado`) em vez dos cartões de KPI histórico; caso contrário mantém os cartões atuais. Rodapé montado a partir de `iesNome`, `semestreRotulo` e `simuladosRotulos`.
  - Bloco `areas`: nota adicional sobre média histórica.
  - Espelhar o mesmo conteúdo nas abas correspondentes do XLSX (cabeçalho da aba de evolução, linhas de rodapé nas abas de indicadores e áreas).
- `components/DialogExportarDados.tsx`: passa `simuladosIds: simuladosValidos`; o `detalhamento` passa a ser buscado também quando o bloco `indicadores` está marcado e há simulado escolhido (hoje só é buscado para `metricasSimulados`/`acertoSemestre`).
- Nenhuma mudança de RPC ou migration: `get_gestor_visao_geral` continua sem parâmetro de simulado, e o recorte por simulado sai de `get_gestor_detalhamento`, que já aceita a lista.
- Testes: estender `__tests__/exportarRecortePdf.test.ts` para cobrir evolução filtrada por `simuladosIds` e a coluna de alunos proficientes.
