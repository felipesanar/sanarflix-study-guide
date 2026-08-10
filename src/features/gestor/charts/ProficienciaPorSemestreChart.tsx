import * as React from 'react';
import { BarraProficiencia, EixoProficiencia, LinhaMetaContinua } from '@/features/gestor/charts/BarraProficiencia';
import { ordenarAlunosNoSimulado } from '@/features/gestor/components/TabelaAlunosSimulado';
import { Icon } from '@/features/gestor/components/Icon';
import { agregarProficienciaPorSemestre } from '@/features/gestor/lib/agregarDetalhamento';
import type { AlunoNoSimulado } from '@/features/gestor/api/types';

/** Altura da lista de alunos do drill-down, com rolagem — refino de 10/08: o
 * drill-down deixou de ser um drawer lateral e passou a caber DENTRO do
 * próprio card, então uma lista longa precisa de um teto com rolagem em vez
 * de esticar o card indefinidamente. */
const ALTURA_LISTA_ALUNOS = 320;

export interface ProficienciaPorSemestreChartProps {
  /**
   * `undefined` (a RPC nunca emitiu a chave `alunos`) e `[]` (recorte sem
   * nenhum aluno) NÃO são a mesma coisa — mesma distinção que `bloco-alunos`
   * já faz em `routes/Detalhamento.tsx`, e que `contratoEnvelopeRpc.test.ts`
   * trava no texto-fonte da rota: `undefined` é o servidor não ter
   * respondido, e a tela não pode concluir nada disso; `[]` é uma resposta
   * real e pode virar "sem alunos". Achatar os dois aqui dentro afirmaria
   * "sem alunos com resultado" quando na verdade a pergunta nunca foi feita
   * ao servidor — o mesmo defeito que já derrubou o bloco de desempenho em
   * produção em 06/08 (ver o comentário do teste).
   */
  alunos: AlunoNoSimulado[] | undefined;
  /**
   * Semestre aberto no drill-down INLINE (refino de 10/08 — deixou de ser um
   * `DrawerAlunosPorSemestre` lateral: a gestora pediu a lista de alunos
   * dentro do mesmo card). Estado do controlador (`routes/Detalhamento.tsx`),
   * o mesmo padrão de `recorte`/`areaDrillDown` já lá.
   */
  semestreAberto: number | null;
  /** Clique numa barra de semestre abre; `null` (botão "Voltar") fecha o drill-down. */
  onAbrirSemestre: (semestre: number | null) => void;
  /**
   * Clique no NOME do aluno, dentro do drill-down — abre o `DrawerAluno` que
   * já existe na rota (o mesmo drawer que `TabelaAlunosSimulado` já aciona).
   * Este componente nunca soube desenhar a ficha do aluno; só repassa o id.
   */
  onSelecionarAluno: (alunoId: string) => void;
}

/**
 * Substitui o gráfico de dispersão ("Dispersão Nota × Semestre") no card
 * homônimo de `routes/Detalhamento.tsx` — refino de 10/08: em vez de uma
 * nuvem de pontos difícil de ler numa reunião, uma barra por semestre com a
 * proficiência MÉDIA, ordenada por número de semestre decrescente. Clicar
 * numa barra abre, DENTRO DO MESMO CARD, a lista de alunos daquele semestre
 * (cada um em barra própria, por nota decrescente); clicar no nome de um
 * aluno abre o `DrawerAluno`.
 *
 * `DispersaoChart.tsx` continua existindo e sendo usado por
 * `GraficoProtagonista.tsx` (Visão Geral, modo "Aluno") e por
 * `EvolucaoRecorte.tsx` (distribuição de um semestre específico dentro do
 * próprio Detalhamento) — este componente troca só o card da dispersão, não
 * o gráfico em si.
 */
export function ProficienciaPorSemestreChart({
  alunos,
  semestreAberto,
  onAbrirSemestre,
  onSelecionarAluno,
}: ProficienciaPorSemestreChartProps) {
  /**
   * As duas agregações rodam SEMPRE, incondicionalmente — nunca atrás de um
   * `if` — porque a árvore de hooks precisa ser idêntica em toda renderização
   * (regra dos hooks). Qual delas é USADA depende de `semestreAberto`, mas as
   * duas são calculadas de qualquer forma; o custo é desprezível (arrays do
   * tamanho do recorte de uma IES, nunca milhares de linhas).
   */
  const semestres = React.useMemo(() => agregarProficienciaPorSemestre(alunos ?? []), [alunos]);
  const alunosDoSemestre = React.useMemo(() => {
    if (semestreAberto === null) return [];
    const doSemestre = (alunos ?? []).filter(
      (a) => a.semestre === semestreAberto && a.proficiencia !== null,
    );
    return ordenarAlunosNoSimulado(doSemestre, 'proficiencia', 'desc');
  }, [alunos, semestreAberto]);

  if (alunos === undefined) {
    return (
      <p
        data-testid="proficiencia-semestre-indisponivel"
        className="py-6 text-center text-sm text-muted-foreground"
      >
        Lista de alunos indisponível neste recorte. Os indicadores acima já refletem este recorte.
      </p>
    );
  }

  if (semestreAberto !== null) {
    return (
      <div data-testid="proficiencia-semestre-drilldown">
        {/* Mesmo padrão de "Voltar" de `DrawerTemasDetalhamento.tsx` — chevron
            à esquerda, cor de marca, sem moldura. */}
        <button
          type="button"
          data-testid="proficiencia-semestre-voltar"
          onClick={() => onAbrirSemestre(null)}
          className="mb-2 inline-flex items-center gap-0.5 rounded-md text-xs font-semibold transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ color: 'var(--gp-brand-on-dark)' }}
        >
          <Icon name="chevron_left" variant="outlined" size={14} box={14} />
          Voltar para semestres
        </button>

        {alunosDoSemestre.length === 0 ? (
          <p
            data-testid="proficiencia-semestre-aluno-vazio"
            className="py-6 text-center text-sm text-muted-foreground"
          >
            Nenhum aluno com nota de proficiência neste semestre.
          </p>
        ) : (
          /*
           * Altura NATURAL aqui, de propósito (pedido explícito, 10/08): o
           * preenchimento de altura do card só vale para o RESUMO por
           * semestre — com poucos alunos, este drill-down pode deixar espaço
           * em branco embaixo, sem esticar linhas isoladas para preencher o
           * card. `ALTURA_LISTA_ALUNOS`/`overflow-y-auto` seguem cobrindo o
           * caso oposto (lista longa).
           *
           * A `<div className="relative">` INTERNA (sem teto de altura
           * própria) é o que faz `LinhaMetaContinua` (`inset:0`, abaixo)
           * cobrir a lista INTEIRA, não só a janela visível: se o `relative`
           * estivesse no `<div>` que tem `overflow-y-auto`, `inset:0`
           * resolveria contra a altura VISÍVEL (a `maxHeight`), e a linha
           * pararia de acompanhar o scroll a partir do primeiro aluno fora da
           * janela.
           */
          <div className="overflow-y-auto" style={{ maxHeight: ALTURA_LISTA_ALUNOS }}>
            <div className="relative">
              <ul
                className="space-y-1"
                aria-label={`Alunos do ${semestreAberto}º semestre, por nota de proficiência`}
              >
                {alunosDoSemestre.map((aluno) => (
                  <BarraProficiencia
                    key={aluno.id}
                    testId={`aluno-semestre-${aluno.id}`}
                    rotulo={aluno.nome}
                    valor={aluno.proficiencia}
                    onClick={() => onSelecionarAluno(aluno.id)}
                    ariaLabel={`Ver detalhes de ${aluno.nome}`}
                  />
                ))}
              </ul>
              <LinhaMetaContinua />
            </div>
          </div>
        )}
        <EixoProficiencia />
      </div>
    );
  }

  if (semestres.length === 0) {
    return (
      <p
        data-testid="proficiencia-semestre-vazio"
        className="py-6 text-center text-sm text-muted-foreground"
      >
        Sem alunos com resultado neste recorte.
      </p>
    );
  }

  return (
    /*
     * Preenche a altura que o card reservou (refino 10/08, pedido explícito):
     * `h-full` consome a altura que `BlocoGestor`/`routes/Detalhamento.tsx`
     * já entregam via `preencherAltura` (o grid ao lado estica os dois cards
     * na altura do mais alto). `<ul>` cresce (`flex-1`) e `justify-between`
     * distribui as barras por igual no espaço disponível — poucas barras
     * ficam mais espaçadas, muitas se aproximam, sem sobrar faixa em branco
     * no fim. `min-h-0` em cada nível é o que permite ao filho `flex-1`
     * respeitar a altura calculada em vez de ser empurrado para a altura do
     * próprio conteúdo (o comportamento padrão de `min-height:auto` do flex).
     *
     * O wrapper é o mesmo `position:relative` que hospeda `LinhaMetaContinua`
     * — ela cobre `<ul>` MAIS o eixo, então a linha nasce no "60" do eixo e
     * sobe contínua até a última barra, atravessando os vãos entre linhas.
     */
    <div className="flex h-full min-h-0 flex-col">
      {/* `relative` só em volta da lista: a linha de meta cobre as barras e os
          vãos, mas NÃO o eixo — assim o "60" do eixo não é atravessado. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ul
          className={
            semestres.length >= 4
              ? 'flex min-h-0 flex-1 flex-col justify-between py-1'
              : 'flex min-h-0 flex-1 flex-col justify-center gap-7 py-1'
          }
          aria-label="Proficiência média por semestre"
        >
          {semestres.map((item) => (
            <BarraProficiencia
              key={item.semestre}
              testId={`proficiencia-semestre-${item.semestre}`}
              rotulo={`${item.semestre}º semestre`}
              caption={`${item.amostra} ${item.amostra === 1 ? 'aluno' : 'alunos'}`}
              valor={item.mediaProficiencia}
              onClick={() => onAbrirSemestre(item.semestre)}
              ariaLabel={`Ver alunos do ${item.semestre}º semestre`}
            />
          ))}
        </ul>
        <LinhaMetaContinua />
      </div>
      <EixoProficiencia />
    </div>
  );
}
