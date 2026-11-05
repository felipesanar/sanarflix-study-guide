import type { ReactNode } from 'react';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import type { VisaoGeralB2b } from '../../api/types';
import { ddmm, ordinal } from './util';

function Celula({ titulo, valor, sufixo, rodape, children }: { titulo: string; valor: string; sufixo?: string | null; rodape?: string | null; children?: ReactNode }) {
  return (
    <div className="-ml-px flex min-w-0 flex-col gap-1.5 border-l border-[var(--gp-border-subtle)] px-5 py-3.5">
      <span className="text-[13px] font-semibold">{titulo}</span>
      <span className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
        <span className="text-2xl font-[750] tracking-[-0.02em]">{valor}</span>
        {sufixo ? <span className="text-[13px] font-medium text-[var(--gp-text-3)]">{sufixo}</span> : null}
      </span>
      {children}
      {rodape ? <span className="text-xs text-[var(--gp-text-2)]">{rodape}</span> : null}
    </div>
  );
}

export interface ResultadosObservadosProps {
  visao: VisaoGeralB2b;
  ordemReferencia: number | null;
  /** Simulados realizados dentro do período (pontos da série). */
  noPeriodo: number;
}

/** Faixa "Resultados observados" (sem selo; separada da projeção, D7). */
export function ResultadosObservados({ visao, ordemReferencia, noPeriodo }: ResultadosObservadosProps) {
  const v = visao;
  const naoFizeram = v.totalAlunos !== null && v.participantes !== null ? v.totalAlunos - v.participantes : null;
  const realizados = v.simuladosRealizados;
  const contratados = v.simuladosContratados;
  const proximo = v.simulados
    .filter((s) => s.status === 'agendado' || s.status === 'previsto')
    .sort((a, b) => a.ordem - b.ordem)[0];
  const pips = contratados !== null && contratados > 0
    ? Array.from({ length: contratados }, (_, i) => {
      const feitos = realizados ?? noPeriodo;
      const inicioPeriodo = feitos - noPeriodo;
      return i >= inicioPeriodo && i < feitos ? 'var(--gp-success)' : i < feitos ? 'var(--gp-border-input)' : 'var(--gp-border-strong)';
    })
    : null;

  return (
    <section aria-label="Resultados observados"
      className="grid min-w-0 overflow-hidden rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      <Celula titulo="Alunos proficientes" valor={formatPct(v.proficientesPct.valor)}
        sufixo={v.proficientes !== null && v.participantes !== null ? `${formatNumero(v.proficientes)} de ${formatNumero(v.participantes)}` : null}
        rodape={`proficiência ${PROFICIENCIA_MINIMA} ou mais`} />
      <Celula titulo="Percentual de acerto" valor={formatPct(v.acertoPct, 1)}
        rodape={`no simulado mais recente do período (${ordinal(ordemReferencia)})`} />
      <Celula titulo="Participação" valor={formatNumero(v.participantes)} sufixo={`/ ${formatNumero(v.totalAlunos)}`}
        rodape={naoFizeram === null ? null : `${formatNumero(naoFizeram)} ${naoFizeram === 1 ? 'aluno da turma não fez' : 'alunos da turma não fizeram'}`} />
      <Celula titulo="Simulados no período" valor={String(noPeriodo)}
        sufixo={contratados === null ? null : `de ${formatNumero(contratados)} contratados`}
        rodape={proximo ? `próximo: ${ordinal(proximo.ordem)} · ${proximo.data ? ddmm(proximo.data) : 'sem data'}` : null}>
        {pips ? (
          <div role="img" aria-label={`${noPeriodo} ${noPeriodo === 1 ? 'simulado' : 'simulados'} no período de ${contratados} contratados`} className="flex gap-1">
            {pips.map((cor, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: cor }} />)}
          </div>
        ) : null}
      </Celula>
    </section>
  );
}
