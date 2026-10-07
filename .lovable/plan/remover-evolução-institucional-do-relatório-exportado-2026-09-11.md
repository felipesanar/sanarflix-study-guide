# Remover "Evolução institucional" do relatório exportado

Com os indicadores saindo simulado a simulado, a seção "Evolução institucional" repete a mesma informação. Ela sai do relatório e da lista de blocos que o gestor pode escolher.

## O que muda

- O painel de exportação passa a não oferecer mais o bloco "Evolução institucional".
- O PDF não terá mais essa página; a planilha não terá mais a aba "Evolução".
- Os demais blocos (indicadores, acerto por grande área, distribuição, alunos) continuam iguais.

## Detalhes técnicos

- `src/features/gestor/lib/exportarRecorte.ts`: remover `'evolucao'` de `BlocoExport`, de `BLOCOS_EXPORT` e da lista de blocos padrão; remover o `case 'evolucao'` do PDF, o bloco da aba "Evolução" no XLSX, a função `tabelaEvolucao` e a helper `evolucaoDoRecorte` (junto com `pontosEvolucao` nas duas funções de export).
- `src/features/gestor/__tests__/exportarRecortePdf.test.ts`: remover o import e as asserções de `evolucaoDoRecorte` e tirar `'evolucao'` da lista de blocos do teste de geração completa.
- Rodar typecheck e os testes de exportação do gestor.
