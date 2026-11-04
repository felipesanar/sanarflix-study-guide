/** Classes compartilhadas pelos blocos da tela Canais (tokens do `.gestor-portal`). */
export const CARTAO = 'min-w-0 rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]';
/** Foco visível 2px na cor da marca, offset 2 (docs/01 § Acessibilidade). */
export const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gp-brand)]';
export const BOTAO_SECUNDARIO =
  `inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] px-3 text-[13px] font-semibold text-[var(--gp-text-1)] hover:bg-[var(--gp-surface-2)] disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors ${FOCO}`;
export const BOTAO_PRIMARIO =
  `inline-flex h-[34px] items-center justify-center whitespace-nowrap rounded-lg bg-[var(--gp-brand)] px-3 text-[13px] font-semibold text-[var(--gp-on-brand)] hover:bg-[var(--gp-brand-strong)] disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors ${FOCO}`;
export const BOTAO_TEXTO =
  `inline-flex h-[34px] items-center whitespace-nowrap rounded-lg px-2.5 text-[13px] font-semibold text-[var(--gp-brand)] hover:bg-[var(--gp-brand-surface-soft)] ${FOCO}`;
export const CAMPO =
  `w-full rounded-lg border bg-[var(--gp-surface-1)] px-2.5 text-[13.5px] text-[var(--gp-text-1)] placeholder:text-[var(--gp-text-3)] ${FOCO}`;
export const TEXTO_ERRO = 'text-xs text-[var(--gp-danger)]';
