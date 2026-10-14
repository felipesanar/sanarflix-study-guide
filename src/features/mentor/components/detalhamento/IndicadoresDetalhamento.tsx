import * as React from 'react';
import { cn } from '@/lib/utils';
import type { DesempenhoTurma } from '@/services/mentor/desempenho';
import { formatDeltaPp, formatPct, resumoPorSimulado, rotuloSimulado, type SimuladoDisponivel } from './util';

interface Props {
  desempenho: DesempenhoTurma;
  /** Simulados do recorte, em ordem cronológica. */
  selecionados: SimuladoDisponivel[];
}

const Delta: React.FC<{ valor: number | null; ref_: string }> = ({ valor, ref_ }) => {
  if (valor === null) return null;
  return (
    <p
      className={cn(
        'text-xs',
        valor > 0 ? 'text-emerald-700' : valor < 0 ? 'text-red-700' : 'text-muted-foreground',
      )}
    >
      {formatDeltaPp(valor)} vs. {ref_}
    </p>
  );
};

const Card: React.FC<{ titulo: string; valor: string; sub?: string; children?: React.ReactNode }> = ({
  titulo,
  valor,
  sub,
  children,
}) => (
  <div className="space-y-1 rounded-xl border bg-card p-4">
    <p className="text-sm text-muted-foreground">{titulo}</p>
    <p className="text-2xl font-semibold">{valor}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    {children}
  </div>
);

/**
 * Indicadores do recorte. O valor é o do último simulado do recorte; o
 * comparativo (vs. simulado anterior do recorte) só aparece com 2+ simulados.
 * Possível aprovação não tem comparativo: a RPC só devolve o valor do último.
 */
export const IndicadoresDetalhamento: React.FC<Props> = ({ desempenho, selecionados }) => {
  const ultimo = selecionados[selecionados.length - 1];
  const anterior = selecionados.length >= 2 ? selecionados[selecionados.length - 2] : null;
  const resumo = resumoPorSimulado(
    desempenho,
    selecionados.map((s) => s.id),
  );
  const rUltimo = resumo[resumo.length - 1];
  const rAnterior = anterior ? resumo[resumo.length - 2] : null;

  const deltaAcerto =
    rAnterior && rUltimo?.acerto_medio !== null && rAnterior.acerto_medio !== null && rUltimo
      ? rUltimo.acerto_medio - rAnterior.acerto_medio
      : null;
  const pctPart = (r: { fizeram: number; total: number }) => (r.total > 0 ? (r.fizeram / r.total) * 100 : 0);
  const deltaPart = rAnterior && rUltimo ? pctPart(rUltimo) - pctPart(rAnterior) : null;

  const part = desempenho.participacao_ultimo;
  const partPct = part.total > 0 ? (part.fizeram / part.total) * 100 : null;

  return (
    <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-3">
      <Card
        titulo="Percentual de acerto médio"
        valor={formatPct(desempenho.acerto_medio_ultimo)}
        sub={ultimo ? `No ${rotuloSimulado(ultimo.sequence_number)}` : undefined}
      >
        {anterior && <Delta valor={deltaAcerto} ref_={rotuloSimulado(anterior.sequence_number)} />}
      </Card>
      <Card
        titulo="Possível aprovação"
        valor={formatPct(desempenho.possivel_aprovacao_pct)}
        sub={
          desempenho.possivel_aprovacao_pct === null
            ? 'Sem alunos com meta e corte cadastrados'
            : 'Alunos no corte da meta, no último simulado do recorte'
        }
      />
      <Card
        titulo="Participação"
        valor={formatPct(partPct)}
        sub={`${part.fizeram} de ${part.total} ${part.total === 1 ? 'aluno' : 'alunos'}`}
      >
        {anterior && <Delta valor={deltaPart} ref_={rotuloSimulado(anterior.sequence_number)} />}
      </Card>
    </section>
  );
};
