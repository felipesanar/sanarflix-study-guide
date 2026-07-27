# 02 · Regras de negócio, métricas e glossário

> Este é o documento mais importante do pacote. Regra aqui vale para **backend e frontend**.

## 1. Métricas e escalas

| Métrica | Escala | Onde aparece | Regra |
|---|---|---|---|
| **Proficiência** | 0–100 | Aluno e instituição | Média institucional = média das proficiências dos participantes. **Nunca** aplicada a área/tema |
| **Nota TRI** | 0–100 | **Só no Detalhamento**, por aluno | Nunca na Visão Geral. Nunca agregada como "TRI da instituição" |
| **Conceito ENAMED projetado** | 1–5 (inteiro) | Visão Geral (KPI) e Detalhamento | Sempre rotulado **"projetado"**. **Não existe média de conceito**: com 2+ simulados vira comparativo lado a lado |
| **Percentual de acerto** | 0–100% | Todas as telas | Única métrica válida para **grande área, especialidade e tema** |
| **Número de acertos** | inteiro | Detalhamento, por aluno | Bruto, sem normalização |
| **Índice de acerto da questão** | 0–100% | Detalhamento das Questões | % de participantes que acertaram |

**Proficiente** = proficiência **> 60**. O corte é do produto, não do MEC — exibir no tooltip de critério.

## 2. Hierarquia de conteúdo (fixa)

```
Grande área  →  Especialidade  →  Tema
(Pediatria)     (Neonatologia)    (Icterícia neonatal precoce)
```

- A **cascata do Diagnóstico** navega 2 níveis: grande área → especialidade.
- Os **temas** (com % de acerto) aparecem no **drawer**, aberto a partir da especialidade.
- A tabela de questões traz os três níveis em colunas: `Nº · Grande área · Especialidade · Tema · Índice de acerto`.

## 3. Filtro global de semestre

Controle segmentado, **idêntico na Visão Geral e no Detalhamento**, persistente entre telas:

| Opção | Comportamento |
|---|---|
| **6º ano (Padrão)** | Recorte padrão. Todos os semestres aparecem nos gráficos, mas **11º e 12º ficam em evidência máxima**; os demais entram esmaecidos, como referência |
| **Geral** | Todos os semestres, sem destaque |
| **Por semestre** | Revela o dropdown de semestre (1º…12º). Só o semestre escolhido em evidência; os dados exibidos são só dele |

Regras derivadas:
- Filtrando por um semestre específico, controles que só fazem sentido em multi-semestre **somem** (não ficam desabilitados).
- Gráficos que comparam semestres, com um único semestre selecionado, viram **distribuição interna daquele semestre** (não uma série de um ponto só).

## 4. Regras do Detalhamento

1. **Nunca "todos"**: seleção explícita de 1+ simulados. Simulado previsto/em processamento aparece desabilitado com o motivo.
2. Acima de **5 simulados** selecionados: aviso não-bloqueante de legibilidade.
3. **1 simulado** → leitura detalhada completa, incluindo **Detalhamento das Questões** (último componente da página).
4. **2+ simulados** → modo comparativo:
   - métricas em **uma coluna por simulado** (sem média única);
   - questões comparadas **por tema**;
   - alunos ganham coluna **Variação** (só quem participou de ambos);
   - **"Detalhamento das Questões" fica oculto**;
   - o comparativo abre **colapsado** (indicadores-chave por simulado) e expande sob demanda.
5. **Régua de evolução** (`1º simulado · anterior · atual`): some com 1 simulado realizado; com 2, mostra os dois pontos.
6. **KPIs do Detalhamento** (3): *Percentual de acerto médio*, *Conceito ENAMED (projetado)*, *Proficiência média*. Reagem a semestre + simulados; os que são média recalculam, o ENAMED vira comparativo.

## 5. Regras da Visão Geral

- **4 indicadores**, nesta ordem: Conceito ENAMED projetado (1–5) · Alunos proficientes (%) · Percentual de acerto (%) · Simulados realizados (feitos/total). Os três primeiros lideram pela **evolução**.
- **Sem Nota TRI** e sem qualquer leitura questão a questão.
- Gráfico protagonista: **evolução ao longo dos simulados**, com alternância **Grande área | Aluno** (não existe opção "Geral" nesse toggle).
- Dispersão por aluno inclui **linha de tendência**.
- Diagnóstico resume por **nível de desempenho**: *excelente*, *mediano*, *crítico*.
- Tabela de alunos: cada aluno carrega a **tag do grupo de evolução** (consistentemente proficiente / em variação / consistentemente não proficiente).

## 6. Ausência, parcialidade e confiança

| Situação | Flag da API | UI |
|---|---|---|
| Aluno não participou | `participou: false` | Célula `—` + badge "Não participou". Não entra em média |
| Amostra pequena (n < 10) | `low_sample: true` | Badge "cobertura parcial" + tooltip com o n |
| Gabarito ainda processando | `status: "processing"` | Card/linha desabilitada com o motivo, sem número |
| Recorte parcial do período | `partial: true` | Faixa informativa acima do bloco |

Nunca preencher lacuna com zero, média do grupo ou estimativa.

## 7. Rastreabilidade

Todo indicador tem tooltip com **Período · Fonte · Atualizado em · Critério**. O texto do critério vem do backend (`criterio`), para não divergir entre telas.

## 8. Glossário para a UI ("Entenda as métricas")

- **Proficiência (0 a 100)** — desempenho estimado do aluno considerando dificuldade das questões.
- **Nota TRI (0 a 100)** — nota do simulado por Teoria de Resposta ao Item.
- **Conceito ENAMED projetado (1 a 5)** — projeção institucional a partir dos simulados. Não é o conceito oficial.
- **Percentual de acerto** — questões certas sobre questões respondidas, no recorte selecionado.
- **Cobertura parcial** — recorte com poucos participantes ou poucas questões; leia com cautela.
