# Exportar PDF na aba Liberações

## O que muda para o admin
- Novo botão **"Exportar PDF"** ao lado do filtro de simulado, em Admin → Simulados → Liberações.
- O botão só aparece quando um simulado específico está selecionado (some em "Todos os simulados"), então cada PDF tem sempre um único simulado.
- O PDF traz exatamente as linhas visíveis na tela (respeitando também a busca por aluno, se houver), com as mesmas 7 colunas e o mesmo formato:
  - **Aluno** (nome + e-mail abaixo), **Simulado**, **Tent.** (#1), **Finalizado** (dd/MM/yyyy às HH:mm, horário de Brasília), **Tempo** (ex.: 1h 32m), **Saídas** ("X aba · Y tela" + "Bloqueado por saídas" quando for o caso), **Ação** ("✓ Liberado" + data, ou "Não liberado" no lugar do botão Liberar).
- Cabeçalho simples: título "Liberações — <nome do simulado>", data/hora da exportação e total de registros. Página em paisagem, A4, com numeração de páginas e cabeçalho da tabela repetido em cada página.
- Nome do arquivo: `liberacoes-<nome-do-simulado>-<data>.pdf`.
- Botão desativado enquanto carrega ou se não houver linhas.

## Detalhes técnicos
- Novo util `src/utils/liberacoesPdf.ts` usando jsPDF + jspdf-autotable (já usados no projeto), com fonte Unicode/filtragem de caracteres conforme padrão existente dos PDFs.
- Extrair `formatTempo` e o formato de data de `LiberacoesTable.tsx` para um helper compartilhado, garantindo que tela e PDF formatem igual.
- `LiberacoesTab.tsx`: `Toolbar` recebe `filteredRows` e o nome do simulado selecionado; renderiza o botão só quando `simuladoFilter !== '__all__'`.
- Teste unitário: botão ausente em "Todos os simulados", presente com simulado selecionado; util gera as 7 colunas com valores formatados.
- Sem mudanças no banco.
