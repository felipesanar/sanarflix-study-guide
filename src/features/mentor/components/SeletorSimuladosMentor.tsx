import * as React from 'react';
import { cn } from '@/lib/utils';
import type { OpcaoSimulado } from './turma/simulados';

interface Props {
  opcoes: OpcaoSimulado[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
  /**
   * Exige ao menos um simulado marcado (Detalhamento: `mentor_detalhamento` falha com lista vazia).
   * Nesse modo "Todos" marca todos os simulados e o último chip marcado não pode ser desmarcado.
   * Sem a flag (Minha turma), seleção vazia = "Todos".
   */
  exigirSelecao?: boolean;
}

/**
 * Filtro de simulados em chips (multi-seleção): "Todos" + "Simulado N".
 * Versão enxuta do seletor do Gestor — o do Gestor depende do cronograma e do
 * recorte global da IES, que o mentor não tem.
 */
export const SeletorSimuladosMentor: React.FC<Props> = ({
  opcoes,
  selecionados,
  onChange,
  exigirSelecao = false,
}) => {
  const todosAtivo = exigirSelecao
    ? opcoes.length > 0 && opcoes.every((o) => selecionados.includes(o.id))
    : selecionados.length === 0;

  const alternar = (id: string) => {
    if (!selecionados.includes(id)) return onChange([...selecionados, id]);
    if (exigirSelecao && selecionados.length <= 1) return;
    onChange(selecionados.filter((x) => x !== id));
  };
  const marcarTodos = () => onChange(exigirSelecao ? opcoes.map((o) => o.id) : []);

  const chip = (ativo: boolean) =>
    cn(
      'rounded-full px-3 py-1 text-sm',
      ativo ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
    );

  return (
    <div role="group" aria-label="Filtro de simulados" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Simulados:</span>
      <button type="button" aria-pressed={todosAtivo} onClick={marcarTodos} className={chip(todosAtivo)}>
        Todos
      </button>
      {opcoes.map((o) => {
        const ativo = selecionados.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            title={o.titulo || undefined}
            aria-pressed={ativo}
            onClick={() => alternar(o.id)}
            className={chip(ativo)}
          >
            Simulado {o.sequence_number}
          </button>
        );
      })}
    </div>
  );
};
