import * as React from 'react';
import { KpiCard, type EstadoKpi } from '@/features/gestor/components/KpiCard';
import { META_VAZIA_ENGAJAMENTO } from '@/features/gestor/components/engajamento/BlocoEngajamento';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { deltaPp, rotuloPeriodoAnterior, rotuloRecencia } from '@/features/gestor/lib/engajamento';
import type { Meta } from '@/features/gestor/api/types';
import type { SituacaoAlunoEngajamento, VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';

export interface KpisEngajamentoProps {
  dados: VisaoGeralEngajamento | undefined;
  meta?: Meta;
  /** Opção de período em vigor (`3m`, `6m`, `30d`, `letivo`, `custom`): dá o rótulo "6 meses anteriores". */
  periodo: string;
  estado?: EstadoKpi;
  onTentarNovamente?: () => void;
}

const SEM_COMPARATIVO = 'sem comparativo para este período';

/**
 * Critério de cada KPI no tooltip "i": uma frase em linguagem de gestor, no lugar do
 * critério técnico longo da RPC (`meta.criterio`), e sem a linha "Fonte".
 */
const CRITERIO = {
  baseAtiva: 'Alunos da sua instituição com acesso vigente ao SanarFlix, do 1º ao 12º semestre.',
  engajados: 'Alunos da base ativa que resolveram ao menos uma questão ou abriram ao menos um conteúdo no período.',
  semRetorno: 'Alunos que já usaram o SanarFlix, mas estão há 30 dias ou mais sem nenhuma atividade.',
  questoes: 'Questões respondidas pelos alunos no período.',
  acerto: 'Percentual de acertos entre as questões respondidas no período.',
  semestre: 'Semestre em que o aluno está.',
  situacao: 'Ativo: usou o SanarFlix nos últimos 30 dias. Sumido: parou há mais tempo. Sem atividade: nunca usou.',
  diasAtivos: 'Dias do período em que o aluno resolveu questões ou abriu conteúdos.',
} as const;

const ROTULO_SITUACAO: Record<SituacaoAlunoEngajamento, string> = {
  ativo: 'Ativo',
  sumido: 'Sumido',
  sem_atividade: 'Sem atividade',
};

/**
 * Valor em texto no lugar do número de 44px: "Situação" ("Sem atividade" não cabe
 * em 44px) e valores que pedem cor própria (`--gp-danger-on`). `KpiCard` fixa a
 * cor do número, então estes passam pelo `corpo`.
 */
function CorpoTexto({
  texto,
  sufixo,
  perigo = false,
  tamanho = 44,
}: {
  texto: string;
  sufixo?: string;
  perigo?: boolean;
  tamanho?: number;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline" style={{ gap: 9, rowGap: 6 }}>
      <span
        data-testid="kpi-valor"
        className="tabular-nums"
        style={{
          fontSize: tamanho,
          fontWeight: 800,
          letterSpacing: '-0.035em',
          lineHeight: tamanho > 30 ? '36px' : '34px',
          color: perigo ? 'var(--gp-danger-on)' : 'var(--gp-text-1)',
        }}
      >
        {texto}
      </span>
      {sufixo ? (
        <span data-testid="kpi-sufixo" className="tabular-nums" style={{ fontSize: 13, color: 'var(--gp-text-3)' }}>
          {sufixo}
        </span>
      ) : null}
    </div>
  );
}

/** "{▲ X p.p.} vs. {rótulo}" quando comparável; senão, a nota alternativa (D10). */
function notaComparativa(
  atual: number | null,
  anterior: number | null,
  comparavel: boolean,
  rotuloAnterior: string,
): string {
  const delta = comparavel ? deltaPp(atual, anterior) : null;
  return delta ? `${delta} vs. ${rotuloAnterior}` : SEM_COMPARATIVO;
}

/**
 * Os 5 KPIs do topo da Visão geral (spec §12.2). Sem aluno: Base ativa, Alunos
 * engajados, Sem retorno há 30+ dias, Questões resolvidas e Acerto médio. Com
 * aluno filtrado (`dados.aluno`): Semestre, Situação, Dias ativos, Questões
 * resolvidas e Acerto, com as médias do semestre dele.
 *
 * Textos literais da §12.2. Nenhum número é calculado aqui: tudo vem da RPC; só
 * se formata e se escolhe a nota (comparativo, média da IES ou "sem comparativo").
 */
export function KpisEngajamento({ dados, meta, periodo, estado = 'ok', onTentarNovamente }: KpisEngajamentoProps) {
  const metaKpi = meta ?? META_VAZIA_ENGAJAMENTO;
  const comum = { meta: metaKpi, estado, onTentarNovamente, ocultarFonte: true };

  const k = dados?.kpis;
  const aluno = dados?.aluno ?? null;
  const alunoRecorte = dados?.recorte.aluno ?? null;
  const semestreFiltrado = dados?.recorte.semestre != null;
  const rotuloAnterior = dados ? rotuloPeriodoAnterior(periodo, dados.periodo.dias) : '';
  const anterior = dados?.periodo.anterior;

  if (k && aluno && alunoRecorte) {
    return (
      <div data-testid="kpis-engajamento" data-modo="aluno" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          {...comum}
          testId="kpi-semestre"
        criterio={CRITERIO.semestre}
          titulo="Semestre"
          valor={`${alunoRecorte.semestre}º`}
          rodape={`turma com ${formatNumero(aluno.baseSemestre)} alunos`}
        />
        <KpiCard
          {...comum}
          testId="kpi-situacao"
        criterio={CRITERIO.situacao}
          titulo="Situação"
          valor={ROTULO_SITUACAO[aluno.situacao]}
          corpo={<CorpoTexto texto={ROTULO_SITUACAO[aluno.situacao]} perigo={aluno.situacao !== 'ativo'} tamanho={28} />}
          rodape={`última atividade: ${rotuloRecencia(aluno.diasSemAtividade)}`}
        />
        <KpiCard
          {...comum}
          testId="kpi-dias-ativos"
        criterio={CRITERIO.diasAtivos}
          titulo="Dias ativos"
          valor={formatNumero(aluno.diasAtivos)}
          valorNumerico={aluno.diasAtivos}
          formatarValor={formatNumero}
          sufixo={`de ${formatNumero(aluno.diasNoPeriodo)}`}
          rodape="dias com alguma atividade no período"
        />
        <KpiCard
          {...comum}
          testId="kpi-questoes"
        criterio={CRITERIO.questoes}
          titulo="Questões resolvidas"
          valor={formatNumero(k.questoes)}
          valorNumerico={k.questoes}
          formatarValor={formatNumero}
          rodape={`média do semestre: ${formatNumero(aluno.mediaSemestreQuestoes)}`}
        />
        <KpiCard
          {...comum}
          testId="kpi-acerto"
        criterio={CRITERIO.acerto}
          titulo="Acerto"
          valor={formatPct(k.acertoPct)}
          rodape={`média do semestre: ${formatPct(aluno.mediaSemestreAcertoPct)}`}
        />
      </div>
    );
  }

  return (
    <div data-testid="kpis-engajamento" data-modo="geral" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        {...comum}
        testId="kpi-base-ativa"
        criterio={CRITERIO.baseAtiva}
        titulo="Base ativa"
        valor={formatNumero(k?.baseAtiva ?? null)}
        valorNumerico={k?.baseAtiva ?? null}
        formatarValor={formatNumero}
        rodape="alunos com acesso vigente"
      />
      <KpiCard
        {...comum}
        testId="kpi-engajados"
        criterio={CRITERIO.engajados}
        titulo="Alunos engajados"
        valor={formatPct(k?.engajadosPct ?? null)}
        valorNumerico={k?.engajadosPct ?? null}
        formatarValor={formatPct}
        sufixo={k ? `${formatNumero(k.engajados)} de ${formatNumero(k.baseAtiva)}` : undefined}
        rodape={
          k
            ? semestreFiltrado
              ? `média da IES: ${formatPct(k.engajadosPctIes)}`
              : notaComparativa(k.engajadosPct, k.engajadosPctAnterior, anterior?.comparavelConteudos ?? false, rotuloAnterior)
            : undefined
        }
      />
      <KpiCard
        {...comum}
        testId="kpi-sem-retorno"
        criterio={CRITERIO.semRetorno}
        titulo="Sem retorno há 30+ dias"
        valor={formatNumero(k?.semRetorno30 ?? null)}
        corpo={
          <CorpoTexto
            texto={formatNumero(k?.semRetorno30 ?? null)}
            sufixo={k ? `${formatPct(k.semRetorno30Pct)} da base` : undefined}
            perigo
          />
        }
        rodape="usaram e pararam"
      />
      <KpiCard
        {...comum}
        testId="kpi-questoes"
        criterio={CRITERIO.questoes}
        titulo="Questões resolvidas"
        valor={formatNumero(k?.questoes ?? null)}
        valorNumerico={k?.questoes ?? null}
        formatarValor={formatNumero}
        rodape={
          k
            ? k.engajados === 0
              ? 'nenhum aluno engajado no período'
              : `${formatNumero(k.questoesPorEngajado)} por aluno engajado`
            : undefined
        }
      />
      <KpiCard
        {...comum}
        testId="kpi-acerto"
        criterio={CRITERIO.acerto}
        titulo="Acerto médio"
        valor={formatPct(k?.acertoPct ?? null)}
        rodape={
          k
            ? semestreFiltrado
              ? `média da IES: ${formatPct(k.acertoPctIes)}`
              : notaComparativa(k.acertoPct, k.acertoPctAnterior, anterior?.comparavelQuestoes ?? false, rotuloAnterior)
            : undefined
        }
      />
    </div>
  );
}
