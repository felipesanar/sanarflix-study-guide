/**
 * Notas dos simulados (B2C): do mais recente ao mais antigo, 3 visíveis + "Ver todos os simulados".
 * Cada linha abre o Detalhamento com aquele simulado (deep link `?s=`). Nota nula não entra na lista.
 */
import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { formatPct } from '@/features/gestor/lib/formatters';
import type { NotaAlunoSimulado } from '../../api/types';
import { formatDataSp, textoVsCorte, TRACO } from './formatos';

const VISIVEIS = 3;

export function ordenarNotas(notas: NotaAlunoSimulado[]): NotaAlunoSimulado[] {
  const t = (iso: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);
  return notas
    .filter((n) => n.acertoPct !== null)
    .sort((a, b) => (b.ordem ?? -Infinity) - (a.ordem ?? -Infinity) || t(b.finalizadaEm) - t(a.finalizadaEm));
}

export function NotasSimulados({ notas, cortePct, onAbrir }: {
  notas: NotaAlunoSimulado[];
  cortePct: number | null;
  onAbrir: (simuladoId: string) => void;
}) {
  const [todas, setTodas] = React.useState(false);
  const id = React.useId();
  const idLista = React.useId();
  const ordenadas = ordenarNotas(notas);
  const visiveis = todas ? ordenadas : ordenadas.slice(0, VISIVEIS);

  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className="m-0 text-[14px] font-[650]">Notas dos simulados</h3>
        <span className="text-[12px]" style={{ color: 'var(--gp-text-3)' }}>% de acerto · vs corte</span>
      </div>
      {ordenadas.length === 0 && <span className="py-2 text-[13px]" style={{ color: 'var(--gp-text-2)' }}>Sem simulados ainda.</span>}
      <div id={idLista} className="flex flex-col">
        {visiveis.map((n) => {
          const nome = n.titulo ?? (n.ordem ? `${n.ordem}º Simulado PRO` : 'Simulado');
          const acertos = n.acertos !== null && n.respondidas !== null ? ` · ${n.acertos} acertos de ${n.respondidas}` : '';
          const data = formatDataSp(n.finalizadaEm);
          const sub = data === TRACO ? acertos.replace(/^ · /, '') : `${data}${acertos}`;
          const diferenca = cortePct !== null && n.acertoPct !== null ? n.acertoPct - cortePct : null;
          return (
            <button
              key={n.simuladoId}
              type="button"
              title="Abrir no detalhamento"
              onClick={() => onAbrir(n.simuladoId)}
              className="flex w-full items-center gap-3 border-0 border-b bg-transparent px-1.5 py-2.5 text-left transition-colors duration-[140ms] hover:bg-[var(--gp-surface-2)] motion-reduce:transition-none max-[640px]:min-h-[44px]"
              style={{ borderColor: 'var(--gp-border-subtle)', color: 'var(--gp-text-1)' }}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[13.5px] font-semibold">{nome}</span>
                {sub && <span className="text-[12px]" style={{ color: 'var(--gp-text-3)' }}>{sub}</span>}
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="text-[17px] font-bold tabular-nums">{formatPct(n.acertoPct === null ? null : Math.round(n.acertoPct))}</span>
                {diferenca !== null ? (
                  <span className="whitespace-nowrap text-[11.5px] font-semibold" style={{ color: diferenca >= 0 ? 'var(--gp-success-on)' : 'var(--gp-danger-on)' }}>
                    {textoVsCorte(diferenca)}
                  </span>
                ) : (
                  <span className="whitespace-nowrap text-[11.5px]" style={{ color: 'var(--gp-text-3)' }}>corte entra com Metas</span>
                )}
              </span>
              <Icon name="chevron_right" size={15} />
            </button>
          );
        })}
      </div>
      {ordenadas.length > VISIVEIS && (
        <button
          type="button"
          aria-expanded={todas}
          aria-controls={idLista}
          onClick={() => setTodas((v) => !v)}
          className="inline-flex items-center gap-1 self-start border-0 bg-transparent py-2 text-[13px] font-semibold max-[640px]:min-h-[44px]"
          style={{ color: '#941F1F' }}
        >
          {todas ? 'Mostrar menos' : 'Ver todos os simulados'}
          <Icon name={todas ? 'expand_less' : 'expand_more'} size={14} />
        </button>
      )}
    </section>
  );
}
