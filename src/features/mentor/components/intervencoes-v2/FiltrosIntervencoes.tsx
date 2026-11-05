import * as React from 'react';
import { cn } from '@/lib/utils';
import type { PerfilB2B, TipoIntervencao } from '../../api/types';
import { FOCO, INPUT } from './estilos';
import { FILTROS_PERFIL, FILTROS_TIPO, PERIODOS, type Modalidade, type PeriodoId } from './util';

interface Props {
  modalidade: Modalidade;
  periodo: PeriodoId;
  onPeriodo: (p: PeriodoId) => void;
  /** Texto do intervalo ("01/10 a 15/10" / "outubro"); null no intervalo livre. */
  rotuloPeriodo: string | null;
  livre: { de: string; ate: string };
  onLivre: (v: { de: string; ate: string }) => void;
  erroLivre: string | null;
  tipo: TipoIntervencao | 'todos';
  onTipo: (t: TipoIntervencao | 'todos') => void;
  perfil: PerfilB2B | 'todos';
  onPerfil: (p: PerfilB2B | 'todos') => void;
}

const CHIP = `h-[30px] whitespace-nowrap rounded-full border bg-[var(--gp-surface-1)] px-3 text-[13px] text-[var(--gp-text-1)] ${FOCO}`;

/** Período (segmented escuro) + intervalo livre; chips de tipo (B2C) ou de perfil (B2B). */
export function FiltrosIntervencoes(p: Props) {
  const id = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const chips = p.modalidade === 'b2b'
    ? FILTROS_PERFIL.map((f) => ({ id: f.id, rotulo: f.rotulo, on: p.perfil === f.id, set: () => p.onPerfil(f.id) }))
    : FILTROS_TIPO.map((f) => ({ id: f.id, rotulo: f.rotulo, on: p.tipo === f.id, set: () => p.onTipo(f.id) }));

  // Setas movem entre as abas do período (padrão de tablist).
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const prox = (i + delta + PERIODOS.length) % PERIODOS.length;
    p.onPeriodo(PERIODOS[prox].id);
    refs.current[prox]?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div role="tablist" aria-label="Período" className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] p-[3px]">
        {PERIODOS.map((per, i) => (
          <button key={per.id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" aria-selected={p.periodo === per.id}
            tabIndex={p.periodo === per.id ? 0 : -1} onClick={() => p.onPeriodo(per.id)} onKeyDown={(e) => onKeyDown(e, i)}
            className={cn('h-7 whitespace-nowrap rounded-md border-0 px-3 text-[12.5px] font-semibold', FOCO,
              p.periodo === per.id ? 'bg-[var(--gp-text-1)] text-[var(--gp-surface-1)]' : 'bg-transparent text-[var(--gp-text-2)]')}>
            {per.rotulo}
          </button>
        ))}
      </div>
      {p.periodo === 'intervalo' ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gp-text-2)]">
            De
            <input type="date" value={p.livre.de} max={p.livre.ate || undefined} onChange={(e) => p.onLivre({ ...p.livre, de: e.target.value })}
              className={cn(INPUT, 'h-8 w-auto border-[var(--gp-border-input)]')} />
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gp-text-2)]">
            Até
            <input type="date" value={p.livre.ate} min={p.livre.de || undefined} onChange={(e) => p.onLivre({ ...p.livre, ate: e.target.value })}
              aria-invalid={!!p.erroLivre} aria-describedby={p.erroLivre ? `${id}-erro` : undefined}
              className={cn(INPUT, 'h-8 w-auto', p.erroLivre ? 'border-[var(--gp-danger)]' : 'border-[var(--gp-border-input)]')} />
          </label>
          {p.erroLivre ? <span id={`${id}-erro`} className="text-xs text-[var(--gp-danger)]">{p.erroLivre}</span> : null}
        </div>
      ) : (
        <span className="whitespace-nowrap text-[12.5px] text-[var(--gp-text-2)]">{p.rotuloPeriodo}</span>
      )}
      <span className="hidden flex-1 min-[720px]:block" />
      <div role="group" aria-label={p.modalidade === 'b2b' ? 'Filtrar por perfil' : 'Filtrar por tipo'} className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.on} onClick={c.set}
            className={cn(CHIP, c.on ? 'border-[var(--gp-text-1)] font-[650]' : 'border-[var(--gp-border-strong)] font-medium')}>
            {c.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
