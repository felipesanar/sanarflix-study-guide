# Remover "Alunos por semestre" da Visão Geral

O card protagonista da Visão Geral passa a ter apenas duas leituras: **Geral** (Evolução institucional) e **Grande área** (Evolução por grande área). O terceiro segmento, **Aluno** (dispersão de proficiência por semestre), sai do seletor e da tela.

## O que muda

- O seletor do card fica com 2 segmentos em vez de 3; a pastilha deslizante e a navegação por teclado (setas, Home/End) se ajustam automaticamente ao novo total.
- O gráfico de dispersão não é mais renderizado nessa tela, incluindo sua tabela alternativa e legendas.
- Nenhuma outra tela é afetada: o mesmo gráfico de dispersão continua sendo usado no Detalhamento (bloco "Distribuição do Nº semestre"), então o componente do gráfico permanece no projeto.

## Detalhes técnicos

- `src/features/gestor/components/GraficoProtagonista.tsx`: remover a entrada `aluno` de `MODOS` e de `TITULOS`, remover o branch `modo === 'aluno'` e o import de `DispersaoChart`. `grid-cols-3` passa a `grid-cols-2` (a largura do indicador já é calculada por `MODOS.length`).
- `src/features/gestor/api/types.ts`: reduzir `ModoGrafico` para `'geral' | 'area'`. O campo `dispersao` do payload continua existindo (usado pelo Detalhamento e por derivações de semestres na Visão Geral).
- `src/features/gestor/__tests__/GraficoProtagonista.test.tsx`: ajustar as asserções que contam 3 segmentos, testam o modo "Aluno" e o ciclo de setas, e adicionar guarda de que o modo "Aluno" não existe mais.
- Rodar lint, typecheck e a suíte do gestor para confirmar que nada mais depende do modo removido.
