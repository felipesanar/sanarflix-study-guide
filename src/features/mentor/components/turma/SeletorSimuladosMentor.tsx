import * as React from 'react';
import { cn } from '@/lib/utils';
import type { OpcaoSimulado } from './simulados';

interface Props {
  opcoes: OpcaoSimulado[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Filtro de simulados em chips (multi-seleção). "Todos" limpa a seleção.
 * Versão enxuta do seletor do Gestor — o do Gestor depende do cronograma e do
 * recorte global da IES, que o mentor não tem.
 */
export const SeletorSimuladosMentor: React.FC<Props> = ({ opcoes, selecionados, onChange }) => {
  const alternar = (id: string) =>
    onChange(selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);
  const chip = (ativo: boolean) =>
    cn(
      'rounded-full px-3 py-1 text-sm',
      ativo ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
    );

  return (
    <div role="group" aria-label="Filtro de simulados" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Simulados:</span>
      <button type="button" aria-pressed={selecionados.length === 0} onClick={() => onChange([])} className={chip(selecionados.length === 0)}>
        Todos
      </button>
      {opcoes.map((o) => {
        const ativo = selecionados.includes(o.id);
        return (
          <button key={o.id} type="button" aria-pressed={ativo} onClick={() => alternar(o.id)} className={chip(ativo)}>
            Simulado {o.sequence_number}
          </button>
        );
      })}
    </div>
  );
};
