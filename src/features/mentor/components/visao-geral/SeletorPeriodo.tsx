import { Icon } from '@/features/gestor/components/Icon';
import type { PeriodoB2b } from '../../api/types';
import { rotulosPeriodo } from './util';

export const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gp-brand)]';

export interface SeletorPeriodoProps {
  valor: PeriodoB2b;
  ano: number;
  onChange: (p: PeriodoB2b) => void;
}

/** Período da Visão Geral (protótipo: grupo de botões com `aria-pressed`, ativo em superfície de marca). */
export function SeletorPeriodo({ valor, ano, onChange }: SeletorPeriodoProps) {
  return (
    <div role="group" aria-label="Período"
      className="flex max-w-full flex-wrap items-center gap-1 rounded-[10px] border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] p-1">
      <span aria-hidden="true" className="inline-flex items-center gap-1.5 px-2 text-xs text-[var(--gp-text-2)]">
        <Icon name="calendar_month" variant="filled" size={14} />Período
      </span>
      {rotulosPeriodo(ano).map(({ chave, rotulo }) => {
        const ativo = chave === valor;
        return (
          <button key={chave} type="button" aria-pressed={ativo} onClick={() => onChange(chave)}
            className={`min-h-11 min-[600px]:min-h-7 whitespace-nowrap rounded-md border px-2.5 text-[12.5px] font-semibold ${FOCO}`}
            style={{
              borderColor: ativo ? 'var(--gp-brand-border)' : 'var(--gp-border-strong)',
              background: ativo ? 'var(--gp-brand-surface-soft)' : 'var(--gp-surface-1)',
              color: ativo ? 'var(--gp-brand)' : 'var(--gp-text-2)',
            }}>
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}
