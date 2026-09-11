# Relatório: remover "Resultado por simulado" e mostrar alunos em "Acerto por semestre"

## O que muda

- O bloco "Resultado por simulado" sai das opções de exportação e do arquivo (PDF e planilha). Os mesmos números já aparecem em "Indicadores do recorte" quando há simulado escolhido.
- "Acerto por semestre" ganha uma coluna "Alunos" com quantos alunos daquele semestre responderam os simulados escolhidos, tanto no PDF quanto na planilha.

## Detalhes técnicos

Banco (uma alteração, aditiva):
- `public.get_gestor_detalhamento(uuid, text, uuid[])`: na CTE `semestres`, acrescentar `count(DISTINCT r.user_id) AS n_alunos` e devolver a chave `alunos` em cada item de `acertoPorAreaESemestre.semestres`. Preservar assinatura, `SECURITY DEFINER`, `search_path`, guards de papel/IES, filtro `type = 'simulado_enamed'` e ACLs. Nenhuma outra chave do envelope muda.

Frontend:
- `src/features/gestor/api/types.ts`: `AcertoPorAreaESemestre.semestres` passa a ter `alunos?: number | null`.
- `src/features/gestor/lib/exportarRecorte.ts`: remover `'metricasSimulados'` de `BlocoExport`, de `BLOCOS_EXPORT`, o `case` do PDF, a aba "Simulados" do XLSX e a função `tabelaMetricas`; em `tabelaAcertoSemestre` e na aba "Acerto por semestre" adicionar a coluna "Alunos" (traço/célula vazia quando não vier valor).
- `src/features/gestor/components/DialogExportarDados.tsx`: em `querDetalhamento`, tirar a referência a `metricasSimulados`.
- `src/features/gestor/__tests__/exportarRecortePdf.test.ts`: trocar as asserções de `metricasSimulados` por `acertoSemestre` (mesmo comportamento de "exige simulado") e garantir que o bloco removido não está mais no catálogo.
- Rodar typecheck e os testes de exportação do gestor.
