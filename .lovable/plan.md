# Refino visual — Proficiência por semestre

Ajustes só de apresentação em `BarraProficiencia.tsx` e `ProficienciaPorSemestreChart.tsx`. Nada de dados, regras ou tamanho externo do card.

## 1. Barras mais largas, espaços equidistantes

A grade interna hoje é `9rem` (rótulo) · `1fr` (trilha) · `4rem` (valor), com gap de 12px — o rótulo reserva largura fixa que sobra em branco.

- Rótulo passa a `minmax(0, 7.5rem)`, valor a `3.5rem`, gap para `1rem`.
- A trilha (coluna do meio) ganha essa largura, então as barras ficam visivelmente maiores e o vão em branco à esquerda desaparece.
- A mesma grade continua compartilhada por barra, eixo e linha de meta (nenhuma conta de pixel manual), então o alinhamento vertical segue exato.
- Barra sobe de 8px para 10px de altura, mantendo o raio pill.

## 2. Linha de meta pontilhada e discreta

- Troca do bloco sólido de 1,5px por uma linha **pontilhada** (`border-left: 1px dashed`) em cinza claro (`--gp-border-strong`, com fallback de opacidade para o tema escuro).
- Ela deixa de invadir o eixo: passa a terminar logo acima dos números, então o "60" do eixo fica limpo e legível. O destaque em negrito do "60" continua sendo a âncora do valor.

## 3. Equilíbrio vertical (corrige o print 2)

Hoje é `justify-between` puro: com 2 semestres, as duas barras vão para os extremos e criam um vazio enorme no meio.

- Limite de espaçamento entre barras: quando há poucas barras, elas passam a ser **agrupadas e centralizadas verticalmente** com um gap máximo (~28px), em vez de esticadas até as bordas.
- Com muitas barras, o comportamento atual de distribuir no espaço todo é mantido (gap mínimo garantido para não colar as linhas).
- Regra: `justify-between` só a partir de 4+ barras; com 1–3 barras, `justify-center` + `gap` fixo.
- Padding vertical da lista reduzido para minimizar branco no topo/base, e o eixo ganha uma separação constante da última barra.

## Detalhes técnicos

- `GRADE_COLUNAS`, `LinhaMetaContinua` e `EixoProficiencia` em `src/features/gestor/charts/BarraProficiencia.tsx`.
- Distribuição vertical no `<ul>` de `src/features/gestor/charts/ProficienciaPorSemestreChart.tsx`, decidida por `semestres.length`.
- Mantém `data-testid` (`linha-meta`, `eixo-meta`, `barra-valor`) para os testes existentes; sem mudança de altura do card (`h-full` continua).
