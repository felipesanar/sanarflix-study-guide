# 04 · Inventário de componentes

Para cada componente: o que é, props sugeridas, e **todos os estados obrigatórios**. Componente sem seus estados não passa no code review.

Estados padrão (quando fizerem sentido): `default · hover · focus · active/press · selected · disabled · loading · empty · error · partial`.

---

## 1. Shell

### `GestorLayout`
Sidebar fixa (240px) + área de conteúdo rolável. **Não existe header no topo do conteúdo.**

Sidebar, de cima para baixo: lockup **SanarFlix Academy** (altura 48px) → **seletor de IES** → navegação (Início, Visão Geral, Detalhamento) → rodapé com notificações e perfil.

- **Seletor de IES**: dropdown **somente** para `admin_b2b` (todas as IES) e `gestor_grupo` (as IES do grupo). Para `gestor_ies` é rótulo estático, sem afordância de clique.
- Item de navegação: `default | hover | active(rota atual) | focus`. Ativo = fundo de marca suave + ícone `filled`; inativo = ícone `outlined`.

### `FiltroSemestre` (segmented)
Opções: `6º ano (Padrão)` · `Geral` · `Por semestre`. A terceira revela o `DropdownSemestre` (1º…12º).
Estados: `default | hover | selected | focus | disabled`. O indicador **desliza** entre opções (transform), não pisca.

### `SeletorSimulados` (multi, só no Detalhamento)
Lista de simulados com checkbox. Realizado = habilitado. Previsto / em processamento = desabilitado com motivo.
Regras: mínimo 1; nunca "todos"; aviso não-bloqueante acima de 5.
Estados: `default | hover | selected | disabled(motivo) | error(nenhum selecionado)`.

---

## 2. Indicadores

### `KpiCard`
```ts
type KpiCard = {
  titulo: string;
  hint?: string;              // linha de critério, ex.: "acima de 60 de proficiência"
  valor: string | number;
  sufixo?: string;            // "/5", "%"
  delta?: { valor: number; direcao: 'up' | 'down' | 'flat'; base: string };
  serie?: { rotulo: string; valor: number }[];  // 1º simulado · anterior · atual
  badge?: 'projetado';
  rastreabilidade: Rastreabilidade;             // Período · Fonte · Atualizado · Critério
  estado?: 'ok' | 'loading' | 'empty' | 'partial';
};
```
- Número protagonista 40–44px/800. Delta em pílula semântica.
- A régua `1º · anterior · atual` **some** com apenas 1 simulado realizado; com 2, mostra dois pontos.
- Ícone `info` abre o **TooltipRastreabilidade**.

### `TooltipRastreabilidade`
Fundo escuro, grade `Período · Fonte · Atualizado em · Critério`. No tema escuro os valores precisam de contraste AA — nunca herdar cor de superfície clara.

---

## 3. Diagnóstico

### `CascataDiagnostico`
Accordion **exclusivo** de 2 níveis: grande área → especialidade. Expande **abaixo do nó** (não é drawer). Cabeçalho e trilha permanecem fixos. Nível seguinte carrega sob demanda.
Por nó: `% de acerto`, nível (`excelente | mediano | critico`), badge de `cobertura parcial`.
Estados: `colapsado | expandido | hover | focus | loading(nível) | low_sample | empty`.

### `DrawerTemas`
Abre a partir de uma **especialidade**. Lista temas com % de acerto e barra. Rodapé: *Exportar recorte* / *Copiar resumo* (nunca a base inteira).
Estados: `loading | conteúdo | empty | error`. Fecha em ESC e no scrim; foco preso enquanto aberto.

---

## 4. Alunos

### `TabelaAlunos` (Visão Geral)
Colunas: Aluno (+ tag do grupo) · Semestre · Proficiência por simulado (`72 · 75 · 78`) · Tendência.
Recursos: busca, ordenação, paginação, truncamento com tooltip. `—` para ausência.
Estados: `default | hover(linha) | selected | loading(skeleton de linhas) | empty | error`.

### `TabelaAlunosSimulado` (Detalhamento)
Colunas: Aluno · Semestre · **Número de acertos** · **Nota TRI** · Proficiência · Situação.
Ordenação por qualquer coluna numérica; ação "Ocultar não participantes"; paginação.
Linha clicada abre o `DrawerAluno` e fica **selecionada** (tint + barra de marca).

### `DrawerAluno` / painel lateral
Cabeçalho com avatar de iniciais, nome, período e situação. Cards: Nota TRI, Percentual de acerto, Situação, Posição/percentil. Bloco "Acerto por grande área". Ações Exportar / Copiar.
Com 2+ simulados selecionados, mostra o **comparativo do aluno entre simulados**.

---

## 5. Detalhamento

### `AcertoPorAreaESemestre`
Barras por grande área **+** barras por semestre, no mesmo bloco. Segue o filtro global (sem toggle próprio).
- `6º ano`: todos os semestres visíveis, 11º e 12º em evidência.
- `Geral`: todos iguais.
- `Por semestre`: só o semestre filtrado em evidência.
- **Clique cruzado**: semestre clicado → áreas recalculam para aquele semestre; área clicada → semestres recalculam para aquela área. Clique de novo limpa.
Estados: `default | area-selecionada | semestre-selecionado | loading | empty`.

### `TabelaQuestoes` (último componente da página, só com 1 simulado)
Toolbar: filtro **Grande área** + ordenação **Ordem da prova · Mais erradas · Mais acertadas**.
Colunas: `Nº · Grande área · Especialidade · Tema · Índice de acerto`.
Linha expande para: enunciado completo, alternativas A–D (correta destacada), distribuição por alternativa com distrator dominante sinalizado.
Estados: `colapsada | expandida | hover | focus | loading | empty | processing`.

### `ComparativoSimulados` (2+)
**Colapsado por padrão**: um card por simulado com % de acerto, ENAMED projetado e proficiência média + delta; o atual em destaque.
**Expandido** (ação "Ver comparativo completo"): métricas lado a lado, questões por tema, alunos com coluna Variação.

---

## 6. Início

### `CronogramaSimulados` (âncora)
Linhas com data, nome e status: `realizado | agendado | reagendado | previsto | em processamento`. Próximo em destaque. Realizado leva ao Detalhamento já filtrado. Bloco "contratados sem data" com ações. Rodapé com proveniência do contrato.
Também existe como **drawer** dentro do Detalhamento (mesmo componente, mesma régua de estados) para não obrigar a volta à home.

### `AvisosSanar`
Não-lido = ponto de marca + fundo destacado; abrir marca como lido. Máx. 3 + "Ver todos".

---

## 7. Transversais

| Componente | Notas |
|---|---|
| `Skeleton` | Reserva a **altura final** do bloco. Shimmer discreto; no escuro, calibrado (nunca clarão branco) |
| `EstadoVazio` | Ilustração Dendê (`monocle-emoji.svg`), título, uma linha de apoio, no máximo 1 ação |
| `EstadoErro` | `sad-emoji.svg`, "Algo deu errado", botão "Tentar novamente" |
| `BadgeStatus` | Pill: proficiente (sucesso) / abaixo do limiar (neutro contornado) / não participou (tracejado) |
| `ChipNivel` | excelente · mediano · crítico. Cor semântica + rótulo textual (nunca só cor) |
| `Paginacao` | Primeira, anterior, páginas, próxima; página atual com alto contraste; alvo mínimo 30px |
| `Glossario` | "Entenda as métricas" — lista definitiva das escalas |
