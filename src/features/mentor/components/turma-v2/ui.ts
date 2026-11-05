/** Classes e tons compartilhados pelos blocos da Minha Turma (tokens `--gp-*` do Gestor). */
import type { CSSProperties } from 'react';

/** Foco visível 2px na cor de marca com offset 2 (docs/01 § Acessibilidade). */
export const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gp-brand)]';

/** Alvo de toque: 44px no mobile, 32px a partir de 600px. */
export const ALVO = 'min-h-11 min-[600px]:min-h-8';

export const BLOCO = 'min-w-0 rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]';

/** Cor semântica só para desempenho, engajamento e erro (docs/01). */
export type Tom = 'sucesso' | 'atencao' | 'perigo' | 'neutro';
export const TOM: Record<Tom, { fundo: string; texto: string; ponto: string }> = {
  sucesso: { fundo: 'var(--gp-success-surface)', texto: 'var(--gp-success-on)', ponto: 'var(--gp-success)' },
  atencao: { fundo: 'var(--gp-warning-surface)', texto: 'var(--gp-warning-on)', ponto: 'var(--gp-warning)' },
  perigo: { fundo: 'var(--gp-danger-surface)', texto: 'var(--gp-danger-on)', ponto: 'var(--gp-danger)' },
  neutro: { fundo: 'var(--gp-surface-3)', texto: 'var(--gp-text-2)', ponto: 'var(--gp-border-input)' },
};

/** Estilo de pílula semântica sobre a anatomia `Tag` do Gestor. */
export const estiloTom = (t: Tom): CSSProperties => ({ color: TOM[t].texto, background: TOM[t].fundo });
