import type * as React from 'react';

/** Bloco do Detalhamento (docs/01): branco, borda `#E9EBED`, raio 12, padding 16; sem sombra. */
export const estiloBloco: React.CSSProperties = {
  background: 'var(--gp-surface-1)',
  border: '1px solid var(--gp-border-strong)',
  borderRadius: 12,
  padding: 16,
};

/** H2 de bloco do Detalhamento: 16 / 650 (igual ao `BlocoGestor`). */
export const h2Bloco: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 650, color: 'var(--gp-text-1)' };

/** Rótulo de coluna / kicker: 10.5 / 600 / uppercase / 0.06em, texto 3. */
export const estiloKicker: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--gp-text-3)',
};

/** Botão secundário compacto (30px) dos protótipos. */
export const botaoSecundario: React.CSSProperties = {
  height: 30,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--gp-border-strong)',
  background: 'var(--gp-surface-1)',
  color: 'var(--gp-text-1)',
  fontSize: 12.5,
  fontWeight: 600,
};

/** Botão primário compacto (30px): `#941F1F`/branco. */
export const botaoPrimario: React.CSSProperties = {
  height: 30,
  padding: '0 12px',
  borderRadius: 8,
  border: 0,
  background: '#941F1F',
  color: '#FFFFFF',
  fontSize: 12.5,
  fontWeight: 600,
};

/** Link de ação: sem fundo, `#941F1F`, 600. */
export const estiloLinkAcao: React.CSSProperties = { color: '#941F1F', fontWeight: 600 };
