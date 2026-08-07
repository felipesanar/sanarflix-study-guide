import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shimmer da referência §9: gradiente que varre a superfície, e não o pulso de
 * opacidade do Tailwind. Os dois tons vêm de `--gp-skeleton`/`--gp-skeleton-brilho`
 * (`gestor-theme.css`), calibrados nos dois temas — no escuro o brilho fica 4
 * pontos de luz acima do card, justamente para nunca virar clarão branco.
 *
 * `animate-shimmer` (tailwind.config.ts: `background-position -200% → 200%`) é
 * um loop infinito de CSS dentro da subárvore `.gestor-portal`, portanto
 * alcançado pelo bloco `prefers-reduced-motion` do tema.
 */
const SHIMMER: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--gp-skeleton) 25%, var(--gp-skeleton-brilho) 50%, var(--gp-skeleton) 75%)',
  backgroundSize: '200% 100%',
};

/** Silhueta interna do bloco de conteúdo, nas proporções da referência. */
const BARRAS: ReadonlyArray<React.CSSProperties> = [
  { height: 12, width: '60%', borderRadius: 'var(--gp-radius-pill)' },
  { height: 30, width: '45%', borderRadius: 'var(--gp-radius-sm)' },
  { height: 10, width: '85%', borderRadius: 'var(--gp-radius-pill)' },
  { height: 56, width: '100%', borderRadius: 'var(--gp-radius-sm)' },
];

interface GestorSkeletonProps {
  /** Altura final do bloco — reservada agora para não haver salto (CLS < 0,1, spec §8.5). */
  altura: number | string;
  rotulo?: string;
  /**
   * `bloco` é a mancha única (barra, linha de tabela, faixa curta). `cartao`
   * desenha a silhueta do conteúdo — título, número grande, apoio e área de
   * gráfico —, que é o que a referência mostra nos cards altos: um retângulo
   * chapado de 300px não diz o que está chegando.
   */
  forma?: 'bloco' | 'cartao';
  className?: string;
}

/** Carregamento de um bloco, com a altura do conteúdo final já reservada (spec §8.4). */
export const GestorSkeleton: React.FC<GestorSkeletonProps> = ({
  altura,
  rotulo = 'Carregando',
  forma = 'bloco',
  className,
}) => {
  const minHeight = typeof altura === 'number' ? `${altura}px` : altura;

  if (forma === 'cartao') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={rotulo}
        style={{ minHeight }}
        className={cn('flex w-full flex-col justify-center gap-[9px]', className)}
      >
        {BARRAS.map((barra, indice) => (
          <div key={indice} className="animate-shimmer" style={{ ...barra, ...SHIMMER }} />
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={rotulo}
      style={{ minHeight, ...SHIMMER }}
      className={cn('w-full animate-shimmer rounded-xl', className)}
    />
  );
};
