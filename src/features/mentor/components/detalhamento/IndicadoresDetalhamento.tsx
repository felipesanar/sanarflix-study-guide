import * as React from 'react';
import { cn } from '@/lib/utils';
import type { DesempenhoTurma, SimuladoB2C } from '@/services/mentor/desempenho';
import {
  escolherAtual,
  formatDeltaPp,
  formatPct,
  indicadoresPorSimulado,
  rotuloSimulado,
  rotuloSimuladoAtual,
} from './util';

interface Props {
  desempenho: DesempenhoTurma;
  /** Simulados do recorte, em ordem cronológica. */
  selecionados: SimuladoB2C[];
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

const diff = (a: number | null | undefined, b: number | null | undefined) =>
  a === null || a === undefined || b === null || b === undefined ? null : a - b;

/**
 * Indicadores do recorte, todos calculados no cliente a partir das notas dos
 * alunos e rotulados com o simulado a que se referem. O "atual" é o último
 * simulado encerrado do recorte (o que a RPC aponta em `participacao_ultimo`),
 * mesmo sem nenhuma nota; se ele não estiver na seleção, o último selecionado
 * com notas. "Em andamento" vem de `encerrado === false` na lista da RPC. O comparativo é sempre com o simulado imediatamente anterior ao
 * atual dentro da seleção, e só existe quando há um.
 */
export const IndicadoresDetalhamento: React.FC<Props> = ({ desempenho, selecionados }) => {
  const indicadores = indicadoresPorSimulado(desempenho.alunos, selecionados);
  const { atual, anterior, emAndamento } = escolherAtual(indicadores, desempenho.participacao_ultimo.simulado_id);
  const rotuloAtual = atual ? rotuloSimuladoAtual(atual.sequence_number, emAndamento) : null;
  const rotuloAnterior = anterior ? rotuloSimulado(anterior.sequence_number) : null;
  const deltaAcerto = diff(atual?.acerto_medio, anterior?.acerto_medio);
  const deltaPart = diff(atual?.participacao_pct, anterior?.participacao_pct);

  const aprovacaoSub = !atual
    ? undefined
    : atual.possivel_aprovacao_pct === null
      ? `Sem alunos com meta e corte cadastrados · ${rotuloAtual}`
      : `${atual.no_corte} de ${atual.com_corte} ${atual.com_corte === 1 ? 'aluno' : 'alunos'} no corte da meta · ${rotuloAtual}`;

  return (
    <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-3">
      <Card
        titulo="Percentual de acerto médio"
        valor={formatPct(atual?.acerto_medio)}
        sub={rotuloAtual ? `No ${rotuloAtual}` : undefined}
      >
        {rotuloAnterior && <Delta valor={deltaAcerto} ref_={rotuloAnterior} />}
      </Card>
      <Card titulo="Possível aprovação" valor={formatPct(atual?.possivel_aprovacao_pct)} sub={aprovacaoSub} />
      <Card
        titulo="Participação"
        valor={formatPct(atual?.participacao_pct)}
        sub={
          atual
            ? `${atual.fizeram} de ${atual.total} ${atual.total === 1 ? 'aluno' : 'alunos'} · ${rotuloAtual}`
            : undefined
        }
      >
        {rotuloAnterior && <Delta valor={deltaPart} ref_={rotuloAnterior} />}
      </Card>
    </section>
  );
};
