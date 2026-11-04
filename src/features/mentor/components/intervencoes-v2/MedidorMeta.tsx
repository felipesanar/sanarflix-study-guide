import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { META_MENSAL, medidorDoMes } from './util';

interface Props {
  estado: 'ok' | 'loading' | 'error';
  /** Realizadas no mês (peso do servidor: turma = 1, grupo = nº de alunos). Sem dado, nada é desenhado. */
  realizadas: number | null;
  mes: { nome: string; ultimoDia: string };
  onTentarNovamente: () => void;
  tentando?: boolean;
}

/** "{feitas} de 15 intervenções planejadas realizadas em {mês}" + 15 marcadores + "faltam {n} até {dd/mm}". */
export function MedidorMeta({ estado, realizadas, mes, onTentarNovamente, tentando }: Props) {
  if (estado === 'loading') return <GestorSkeleton altura={46} rotulo="Carregando medidor do mês" className="rounded-xl" />;
  if (estado === 'error' || realizadas === null) {
    return <EstadoErro onRetry={onTentarNovamente} tentandoNovamente={tentando} />;
  }
  const m = medidorDoMes(realizadas);
  return (
    <div data-testid="medidor" className="flex flex-wrap items-center gap-3.5 rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] px-4 py-3">
      <span className="text-[13.5px] text-[var(--gp-text-1)]">
        <b className="tabular-nums">{m.feitas} de {META_MENSAL}</b> intervenções planejadas realizadas em {mes.nome}
      </span>
      {/* TODO(P6): meta de 15/mês é hipótese até a coordenação de mentores validar. */}
      <div role="progressbar" aria-label={`Meta do mês: ${m.feitas} de ${META_MENSAL} intervenções realizadas`}
        aria-valuemin={0} aria-valuemax={META_MENSAL} aria-valuenow={m.preenchidos}
        className="flex min-w-[160px] flex-1 gap-[3px]">
        {Array.from({ length: META_MENSAL }, (_, i) => (
          <span key={i} aria-hidden="true" className="h-1.5 flex-1 rounded-full"
            style={{ background: i < m.preenchidos ? 'var(--gp-success)' : 'var(--gp-border-strong)' }} />
        ))}
      </div>
      <span className="whitespace-nowrap text-[12.5px] text-[var(--gp-text-2)]">faltam {m.faltam} até {mes.ultimoDia}</span>
    </div>
  );
}
