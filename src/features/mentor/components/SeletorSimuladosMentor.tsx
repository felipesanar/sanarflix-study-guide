import * as React from 'react';
import { cn } from '@/lib/utils';
import type { SimuladoBloqueado } from '@/services/mentor/desempenho';
import type { OpcaoSimulado } from './turma/simulados';
import { formatDiaMesHora } from './turma/util';

/** Tooltip do chip bloqueado: quando o resultado é liberado (ou que ainda não há data). */
export function dicaBloqueado(b: SimuladoBloqueado): string {
  return b.libera_em && formatDiaMesHora(b.libera_em) !== '—'
    ? `Resultado liberado em ${formatDiaMesHora(b.libera_em)}`
    : 'Resultado ainda não liberado';
}

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
  /**
   * Simulados cujo resultado ainda não foi liberado aos alunos (id → info). Viram chips desabilitados
   * com tooltip da data de liberação; "Todos" não os marca. Um bloqueado que já está marcado
   * continua desmarcável. Ausente = comportamento de antes.
   */
  bloqueados?: Record<string, SimuladoBloqueado>;
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
  bloqueados,
}) => {
  const livres = opcoes.filter((o) => !bloqueados?.[o.id]);
  const todosAtivo = exigirSelecao
    ? livres.length > 0 && livres.every((o) => selecionados.includes(o.id))
    : selecionados.length === 0;

  const alternar = (id: string) => {
    if (!selecionados.includes(id)) return onChange([...selecionados, id]);
    if (exigirSelecao && selecionados.length <= 1) return;
    onChange(selecionados.filter((x) => x !== id));
  };
  const marcarTodos = () => onChange(exigirSelecao ? livres.map((o) => o.id) : []);

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
        const bloqueado = bloqueados?.[o.id];
        if (!bloqueado) {
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
        }
        const dica = dicaBloqueado(bloqueado);
        // Botão desabilitado não dispara tooltip nativo: o `title` vai no invólucro.
        return (
          <span key={o.id} title={dica} data-testid={`chip-bloqueado-${o.sequence_number}`}>
            <button
              type="button"
              aria-pressed={ativo}
              aria-describedby={`dica-bloqueado-${o.id}`}
              disabled={!ativo}
              onClick={() => alternar(o.id)}
              className={cn(chip(ativo), 'opacity-60', !ativo && 'cursor-not-allowed line-through decoration-1')}
            >
              Simulado {o.sequence_number}
            </button>
            <span id={`dica-bloqueado-${o.id}`} className="sr-only">
              {dica}
            </span>
          </span>
        );
      })}
    </div>
  );
};
