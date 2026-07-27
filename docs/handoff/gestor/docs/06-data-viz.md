# 06 · Data viz

O gráfico é o herói desta ferramenta. Os SVGs do protótipo são **spec visual**; implemente com Visx ou Nivo, temado pelos tokens.

## Princípios

1. **Eixos e grades discretos**: grade horizontal em divisor sutil, 1px; sem grade vertical, salvo dispersão.
2. **Legenda sempre**, com o rótulo por extenso. Cor nunca é a única informação.
3. **Tooltip rico**: título (nome do simulado/área/aluno), valor formatado, contexto (`n` participantes), e comparação quando houver.
4. **Formatação**: `pt-BR`, tabular-nums, `%` colado no número, sem casas decimais salvo necessidade.
5. **Meta** desenhada como linha tracejada com rótulo à direita.
6. **Animação de entrada**: linhas se desenham L→R em `motion-5`; barras crescem da base; números contam até o valor. Respeitar `prefers-reduced-motion`.
7. **Estado vazio do gráfico** é desenhado (eixos + mensagem), não um bloco em branco.

---

## 1. Evolução (linha + área) — protagonista da Visão Geral

- Eixo X: simulados na ordem cronológica (rótulo curto: `SN1`, `SN2`, …; tooltip traz o nome completo e a data).
- Eixo Y: 0–100 (proficiência) com ticks 20/40/60/80.
- Série principal: linha de 2.5px + área com gradiente da marca (14% → 0%). Ponto atual com halo.
- Linha de **meta 60** tracejada.
- Toggle **Grande área | Aluno** troca o conjunto de séries com fade cruzado (não redesenha do zero).
- Com **1 simulado realizado**: não desenhar linha de um ponto — mostrar o ponto com rótulo e a nota "primeira medição; a evolução aparece a partir do segundo simulado".

## 2. Multi-linha por grande área

Uma linha por grande área, cores da paleta de séries (ordem fixa). A área crítica ganha peso 3px; as demais 1.5px a 70% de opacidade. Hover em uma série destaca e esmaece as outras. Legenda clicável (isola/reativa).

## 3. Dispersão Nota × Semestre

- X: semestre do aluno (1º…12º) · Y: nota (0–100).
- Ponto = aluno; opacidade 0.75; ponto sob hover ganha anel.
- **Linha de tendência** (regressão linear simples) tracejada, com rótulo do coeficiente em texto simples.
- Linha de corte (60) discreta.
- **Com um único semestre filtrado**: vira distribuição daquele semestre — uma coluna de pontos com *jitter* horizontal + mediana em destaque; o rótulo explica a mudança.
- Muitos pontos (>800): amostrar ou usar densidade; nunca travar o frame.

## 4. Barras: acerto por área × acerto por semestre

Dois grupos no mesmo bloco (ver `04-componentes.md`):
- Barras horizontais por grande área (nome à esquerda, % à direita, tabular).
- Barras verticais por semestre, com evidência conforme o filtro (6º ano → 11º/12º destacados).
- **Clique cruzado** com transição de 200ms nos valores; o item selecionado recebe contorno e o restante esmaece.
- Sempre exibir o `%` no fim da barra — não obrigar leitura pelo eixo.

## 5. Distribuição por alternativa (questão expandida)

Barra por alternativa A–D. Correta em sucesso, distrator dominante em erro, demais em neutro. Legenda: "correta" / "distrator mais marcado". Uma frase de leitura ("o distrator C domina — sinaliza confusão conceitual, não só dificuldade").

## 6. Sparkline (drawer do aluno)

Sem eixo, sem grade, 3 a 5 pontos, último ponto marcado. Acompanha sempre um número textual — nunca fica sozinha.

---

## Acessibilidade dos gráficos

- `role="img"` + `<title>`/`<desc>` descrevendo a leitura ("Proficiência sobe de 57 para 63 entre os três simulados").
- Alternativa tabular acessível (link "Ver como tabela" ou tabela visualmente oculta).
- Tooltip acessível por teclado (setas navegam pontos).
- Contraste das séries ≥ 3:1 contra o fundo; no escuro use as variantes claras da paleta.
