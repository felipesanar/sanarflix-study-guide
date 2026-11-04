/** Classes compartilhadas da tela (docs/01 § Padrões de componentes e § Acessibilidade). */

/** Foco visível: anel de 2px na cor da marca, offset 2px. */
export const FOCO =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gp-brand)]';

export const BOTAO_PRIMARIO = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border-0 bg-[var(--gp-brand)] px-4 font-semibold text-[var(--gp-text-inverse)] hover:bg-[var(--gp-brand-strong)] disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors ${FOCO}`;

export const BOTAO_SECUNDARIO = `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] px-3 text-[13px] font-semibold text-[var(--gp-text-1)] hover:border-[var(--gp-border-input)] disabled:cursor-not-allowed disabled:text-[var(--gp-text-3)] motion-safe:transition-colors ${FOCO}`;

export const INPUT = `h-9 w-full min-w-0 rounded-lg border bg-[var(--gp-surface-1)] px-2.5 text-[13.5px] text-[var(--gp-text-1)] placeholder:text-[var(--gp-text-3)] ${FOCO}`;
