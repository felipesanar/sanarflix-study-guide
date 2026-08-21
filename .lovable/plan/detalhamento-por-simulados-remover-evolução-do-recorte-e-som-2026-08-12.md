# Detalhamento por Simulados: remover "Evolução do recorte" e somar o 4º indicador ao comparativo

## 1. Remover o bloco "Evolução do recorte"

O bloco sai da rota `/gestor/detalhamento` por completo — some tanto no caso de 2+ simulados (linha + meta) quanto na variante "Distribuição do Xº semestre", que é o mesmo componente quando o filtro está num semestre específico. Nada é substituído: a proficiência média do recorte continua no KPI logo acima, e a evolução entre simulados passa a ser lida no comparativo.

Se você quiser preservar a variante "Distribuição do Xº semestre" (o gráfico de dispersão que aparece quando o filtro de semestre é 1º…12º), me diga antes de aprovar — o plano atual remove as duas.

## 2. Quarto indicador no "Comparativo entre simulados"

Cada card de simulado passa a mostrar 4 linhas, nesta ordem:

1. Percentual de acerto
2. Conceito ENAMED (proj.)
3. Proficiência média
4. **Alunos proficientes (%)** — novo

O novo indicador segue exatamente as mesmas regras dos outros três:

- valor em % com uma casa (`61,0%` no padrão pt-BR), fonte mono, tabular;
- pílula de delta contra o simulado anterior em pontos percentuais; o primeiro card não tem pílula;
- quando o simulado não tem TRI processado, a célula mostra `—` e não há delta — nunca 0;
- o texto de apoio do bloco passa a citar os quatro eixos ("acerto, conceito, proficiência e alunos proficientes").

A tabela "Métricas por simulado" do comparativo completo ganha a mesma linha nova, uma coluna por simulado, mantendo a regra de nunca gerar média única entre simulados.

## Detalhes técnicos

- `src/features/gestor/routes/Detalhamento.tsx`: remover o bloco `bloco-evolucao` (incluindo o `BlocoGestor`, o import de `EvolucaoRecorte`/`ehSemestreEspecifico` e o uso de `dados.dispersao` só para esse fim) e reindexar o `classeRevelacao` das seções seguintes para a cascata de entrada não pular um degrau.
- Excluir `src/features/gestor/components/EvolucaoRecorte.tsx` e `src/features/gestor/__tests__/EvolucaoRecorte.test.tsx`. `DispersaoChart` e `EvolucaoChart` permanecem — são usados em outras telas.
- Ajustar `src/features/gestor/__tests__/a11y.test.tsx` e qualquer asserção que dependa de `bloco-evolucao` ou do `<h2>` daquele card.
- `ComparativoSimulados.tsx`: nova `LinhaIndicador` com `valorTestId="card-proficientes"` / `deltaTestId="card-delta-proficientes"` usando `m.proficientesPct` (campo já existente em `MetricasSimulado` e já devolvido por `get_gestor_detalhamento`), delta via `calcularVariacao`, formatação por `formatPct`; e nova `LinhaMetrica` "Alunos proficientes" na tabela expandida.
- Sem mudança de banco, RPC ou tipos.
- Testes novos em `ComparativoSimulados.test.tsx`: 4 indicadores por card, delta apenas do 2º card em diante, `—` sem delta quando `proficientesPct` é `null`/ausente, e a linha nova presente na tabela expandida.
