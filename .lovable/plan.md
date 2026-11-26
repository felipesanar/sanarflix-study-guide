# Remover o card "Sem retorno há 30+ dias" do Engajamento do gestor

## O que muda
- Na Visão geral de Engajamento do gestor, o card "Sem retorno há 30+ dias" sai do topo.
- Os 4 cards restantes (Base ativa, Alunos engajados, Questões resolvidas, Acerto médio) passam a ocupar toda a largura, em 4 colunas iguais.
- Quando um aluno é filtrado, os 5 cards dele (Semestre, Situação, Dias ativos, Questões, Acerto) continuam como estão.
- A seção "Quem não voltou" mais abaixo na página e o painel de Engajamento do admin não mudam.

## Detalhes técnicos
- `src/features/gestor/components/engajamento/KpisEngajamento.tsx`: remover o KpiCard `kpi-sem-retorno` do modo geral, trocar a grade desse modo para `lg:grid-cols-4` e atualizar o comentário.
- `src/features/gestor/__tests__/engajamento/VisaoGeralTopo.test.tsx`: ajustar para afirmar que o card não aparece mais.
- Rodar esse teste.
- Pergunta à parte: o export (PDF/XLSX) do Engajamento também traz "Sem retorno há 30+ dias"; por padrão fica como está.
