import * as React from 'react';
import { cn } from '@/lib/utils';
import type { StatusSimulado } from '@/features/gestor/api/types';

/** Rótulos de status do cronograma (spec §6.4). `previsto` = slot sem data. */
export const ROTULO_STATUS: Record<StatusSimulado, string> = {
  realizado: 'Realizado',
  agendado: 'Agendado',
  reagendado: 'Reagendado',
  previsto: 'Previsto',
  processing: 'Em processamento',
};

interface Anatomia {
  estilo: React.CSSProperties;
  /** Só `reagendado` é pílula na referência; todo o resto é texto na coluna de status. */
  pilula?: boolean;
  /**
   * Status que a própria linha já comunica por outro elemento — o rótulo
   * existe só para leitor de tela. Ver o comentário de `realizado` em
   * {@link ANATOMIA}.
   */
  apenasParaLeitorDeTela?: boolean;
}

/**
 * Anatomia por status, tirada da régua de estados do cronograma na referência.
 *
 * O ponto que a versão anterior errava: `realizado` era `Badge variant="default"`
 * — pílula de marca SÓLIDA. É o status mais frequente da lista, então o
 * cronograma inteiro gritava mais alto que o selo "Próximo", a única pílula de
 * marca preenchida que a referência usa. Aqui `realizado` é o item mais CALMO:
 * texto de marca com a afordância de resultado, porque a linha já navega.
 *
 * `reagendado` é a única pílula (warning, 11px/600, 3px 10px) — a referência a
 * usa para chamar atenção à data que mudou. `previsto`/`processing` são texto
 * terciário/warning, nunca pílula.
 *
 * `realizado` não desenha nada: na referência a linha realizada termina em
 * "Resultados ›" e mais nada — é a própria afordância que diz que o simulado
 * já aconteceu. Este componente chegou a desenhar "Realizado · Resultados ›"
 * ao lado do "Resultados ›" que `ItemLinha` já renderiza, e a palavra saía
 * duas vezes na mesma linha. Quem some é o rótulo VISUAL: o texto continua no
 * DOM para leitor de tela, porque um chevron vermelho não anuncia "realizado".
 */
const ANATOMIA: Record<StatusSimulado, Anatomia> = {
  realizado: {
    estilo: { color: 'var(--gp-brand-on-dark)', fontWeight: 600 },
    apenasParaLeitorDeTela: true,
  },
  agendado: { estilo: { color: 'var(--gp-text-2)', fontWeight: 600 } },
  reagendado: {
    estilo: {
      color: 'var(--gp-warning-on)',
      background: 'var(--gp-warning-surface)',
      fontWeight: 600,
    },
    pilula: true,
  },
  previsto: { estilo: { color: 'var(--gp-text-3)' } },
  processing: { estilo: { color: 'var(--gp-warning-on)', fontWeight: 600 } },
};

/** Status de um simulado no cronograma — sempre com rótulo textual. */
export const BadgeStatus: React.FC<{ status: StatusSimulado; className?: string }> = ({
  status,
  className,
}) => {
  const { estilo, pilula, apenasParaLeitorDeTela } = ANATOMIA[status];

  if (apenasParaLeitorDeTela) {
    return (
      <span data-testid={`status-${status}`} className={cn('sr-only', className)}>
        {ROTULO_STATUS[status]}
      </span>
    );
  }

  return (
    <span
      data-testid={`status-${status}`}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap leading-none', className)}
      style={{
        fontSize: 11,
        // Cross-fade de estado (comportamento 21): status troca no mesmo nó
        // (ex.: `agendado` → `reagendado`) sem corte seco; 200ms, sem mudar
        // tamanho/padding — quem decide isso é `pilula`/`estilo`, intocados.
        transition: 'background-color var(--gp-motion-3) var(--gp-ease), color var(--gp-motion-3) var(--gp-ease)',
        ...(pilula ? { borderRadius: 'var(--gp-radius-pill)', padding: '3px 10px' } : null),
        ...estilo,
      }}
    >
      {ROTULO_STATUS[status]}
    </span>
  );
};
