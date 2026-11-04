/**
 * Identidade visual por contexto (B2C: tribo · B2B: IES).
 *
 * Valores tirados dos protótipos (capturas/b2c/01-inicio.png e
 * capturas/b2b/01-inicio.png). Em produção as cores e os assets devem vir do
 * cadastro da tribo/IES; este arquivo é o fallback e o contrato de forma.
 *
 * Regra D6: a identidade só aparece na faixa do Início, no cartão da sidebar,
 * no mural visto pelo aluno e no drawer do aluno. Nenhuma outra tela recebe
 * cor de tribo.
 */
import type { TriboId } from '../api/types';

export interface TemaContexto {
  /** Fundo da faixa do Início. */
  faixa: string;
  /** Borda interna da faixa. */
  faixaBorda: string;
  /** Eyebrow sobre a faixa (só B2C). */
  destaque: string;
  /** Botão primário sobre a faixa. */
  acao: { fundo: string; fundoHover: string; texto: string };
  /** Botão ghost sobre a faixa. */
  acaoSecundariaTexto: string;
  /** Fundo do cartão de contexto na sidebar. */
  cartaoSidebar: string;
  cartaoSidebarTexto: string;
}

interface CoresTribo { sig: string; shadow: string; glow: string }

const CORES_TRIBO: Record<TriboId, CoresTribo> = {
  carcara: { sig: '#D9771F', shadow: '#3A1405', glow: '#FFB547' },
  camaleao: { sig: '#1F9D6B', shadow: '#0B3B2C', glow: '#5CF2B5' },
  colmeia: { sig: '#E0A526', shadow: '#3B2A05', glow: '#FFE08A' },
  octopus: { sig: '#3B3FB8', shadow: '#0D0F33', glow: '#8FA8FF' },
};

export function temaTribo(id: TriboId): TemaContexto {
  const c = CORES_TRIBO[id];
  return {
    faixa: `radial-gradient(circle at calc(100% - 40px) 50%, ${c.sig}73, rgba(0,0,0,0) 130px), linear-gradient(100deg, #160608 0%, ${c.shadow} 100%)`,
    faixaBorda: 'inset 0 0 0 1px rgba(232,205,143,0.14)',
    destaque: c.glow,
    acao: { fundo: '#E8CD8F', fundoHover: '#F2DCA6', texto: '#1A0509' },
    acaoSecundariaTexto: '#E8CD8F',
    cartaoSidebar: c.shadow,
    cartaoSidebarTexto: '#F4EDE4',
  };
}

/** UniAtenas. Outras IES: cadastrar `iesTheme`; sem cadastro, usar `temaIesPadrao`. */
export const temaUniAtenas: TemaContexto = {
  faixa:
    'radial-gradient(circle at calc(100% - 44px) 50%, rgba(248,148,28,0.30), rgba(248,148,28,0) 130px), linear-gradient(100deg, #1A0A05 0%, #24100A 40%, #3A1203 100%)',
  faixaBorda: 'inset 0 0 0 1px rgba(248,148,28,0.14)',
  destaque: '#FFD6A6',
  acao: { fundo: '#F8941C', fundoHover: '#FFA83D', texto: '#140803' },
  acaoSecundariaTexto: '#FFD6A6',
  cartaoSidebar: '#FFF4E8',
  cartaoSidebarTexto: '#3A1203',
};

/** Fallback institucional: tokens do Gestor, sem cor própria da IES. */
export const temaIesPadrao: TemaContexto = {
  faixa: 'var(--gp-surface-1)',
  faixaBorda: 'inset 0 0 0 1px var(--gp-border-strong)',
  destaque: 'var(--gp-text-3)',
  acao: { fundo: 'var(--gp-brand)', fundoHover: 'var(--gp-brand-strong)', texto: '#FFFFFF' },
  acaoSecundariaTexto: 'var(--gp-text-2)',
  cartaoSidebar: 'var(--gp-surface-2)',
  cartaoSidebarTexto: 'var(--gp-text-1)',
};
