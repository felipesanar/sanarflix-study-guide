import * as React from 'react';
import { MetricValue, GestorPanel } from '@/experiences/gestor/ui';
import { cn } from '@/lib/utils';
import type { QuestionStat } from '@/services/gestor/questionStats';

const MAX_QUESTOES = 20;

/** Título de exibição da linha: usa o tema quando disponível, senão as ~8 primeiras palavras do enunciado. */
function questionTitle(q: QuestionStat): string {
  if (q.tema) return q.tema;
  const words = q.enunciado.trim().split(/\s+/).slice(0, 8);
  return words.join(' ') + (q.enunciado.trim().split(/\s+/).length > 8 ? '…' : '');
}

interface QuestoesErradasListProps {
  simuladoNome?: string;
  questoes: QuestionStat[];
  selectedId: string | null;
  onSelect: (questionId: string) => void;
}

/**
 * Lista das questões com pior desempenho do simulado ativo (até 20, já vêm
 * ordenadas por `pct_acerto` ascendente do RPC). Cada linha é um botão que
 * seleciona a questão exibida no painel de detalhe ao lado.
 */
export const QuestoesErradasList: React.FC<QuestoesErradasListProps> = ({
  simuladoNome,
  questoes,
  selectedId,
  onSelect,
}) => {
  const top = questoes.slice(0, MAX_QUESTOES);

  return (
    <GestorPanel
      title={`Questões mais erradas${simuladoNome ? ` · ${simuladoNome}` : ''}`}
      contentClassName="p-0"
    >
      <ul className="divide-y divide-border">
        {top.map((q) => {
          const isActive = q.question_id === selectedId;
          const areaTema = [q.grande_area, q.tema].filter(Boolean).join(' · ');
          return (
            <li key={q.question_id}>
              <button
                type="button"
                onClick={() => onSelect(q.question_id)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2 border-transparent',
                  'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive && 'border-l-primary bg-accent',
                )}
              >
                <span className="shrink-0 inline-flex items-center justify-center rounded-md bg-muted px-2 py-1 text-xs font-mono tabular-nums font-semibold text-muted-foreground">
                  Q{q.numero_questao}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {questionTitle(q)}
                  </span>
                  {areaTema && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {areaTema}
                    </span>
                  )}
                </span>
                <MetricValue size="sm" className="shrink-0 text-red-600 dark:text-red-400">
                  {Math.round(q.pct_acerto)}%
                </MetricValue>
              </button>
            </li>
          );
        })}
      </ul>
    </GestorPanel>
  );
};
