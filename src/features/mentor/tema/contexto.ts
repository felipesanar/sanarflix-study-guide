/** Identidade restrita à faixa, sidebar, mural do aluno e drawer (D6). */
import type { TriboId } from '../api/types';

export interface TemaContexto {
  faixa: string;
  faixaBorda: string;
  texto: string;
  destaque: string;
  acao: { fundo: string; fundoHover: string; texto: string };
  acaoSecundariaTexto: string;
  cartaoSidebar: string;
  cartaoSidebarTexto: string;
  selo?: string | null;
  logo?: string | null;
}
export interface CoresTribo { sig: string; shadow: string; glow: string }
export interface IdentidadeTribo {
  lema: string;
  cores: CoresTribo;
}
export type CadastroTribo = { lema?: string; cores?: Partial<CoresTribo> };
const TRIBOS: Record<TriboId, IdentidadeTribo> = {
  carcara: { lema: 'Nota 90+', cores: { sig: '#D9771F', shadow: '#3A1405', glow: '#FFB547' } },
  camaleao: { lema: 'Faculdade e ENAMED em sincronia', cores: { sig: '#1F9D6B', shadow: '#0B3B2C', glow: '#5CF2B5' } },
  colmeia: { lema: 'Constância e hábito', cores: { sig: '#E0A526', shadow: '#3B2A05', glow: '#FFE08A' } },
  octopus: { lema: 'Pouco tempo, muito foco', cores: { sig: '#3B3FB8', shadow: '#0D0F33', glow: '#8FA8FF' } },
};
export function identidadeTribo(id: TriboId, cadastro?: CadastroTribo): IdentidadeTribo {
  return { lema: cadastro?.lema ?? TRIBOS[id].lema, cores: { ...TRIBOS[id].cores, ...cadastro?.cores } };
}
export function temaTribo(id: TriboId, cadastro?: CadastroTribo): TemaContexto {
  const c = identidadeTribo(id, cadastro).cores;
  return {
    faixa: `radial-gradient(circle at calc(100% - 40px) 50%, ${c.sig}73, rgba(0,0,0,0) 130px), linear-gradient(100deg, #160608 0%, ${c.shadow} 100%)`,
    faixaBorda: 'inset 0 0 0 1px rgba(232,205,143,0.14)', texto: '#F4EDE4', destaque: c.glow,
    acao: { fundo: '#E8CD8F', fundoHover: '#F2DCA6', texto: '#1A0509' },
    acaoSecundariaTexto: '#E8CD8F', cartaoSidebar: c.shadow, cartaoSidebarTexto: '#F4EDE4',
  };
}

export interface IesTheme {
  fundo: string;
  acento: string;
  acentoHover: string;
  selo: string | null;
  logo: string | null;
  /** Cadastro pode ajustar contraste quando a identidade usa fundo escuro. */
  texto?: string;
  textoAcao?: string;
}
export const temaIesPadrao: TemaContexto = {
  faixa: 'var(--gp-surface-1)', faixaBorda: 'inset 0 0 0 1px var(--gp-border-strong)',
  texto: 'var(--gp-text-1)', destaque: 'var(--gp-text-3)',
  acao: { fundo: 'var(--gp-brand)', fundoHover: 'var(--gp-brand-strong)', texto: 'var(--gp-surface-1)' },
  acaoSecundariaTexto: 'var(--gp-text-2)', cartaoSidebar: 'var(--gp-surface-2)', cartaoSidebarTexto: 'var(--gp-text-1)',
  selo: null, logo: null,
};
export function temaIes(iesTheme?: Partial<IesTheme> | null): TemaContexto {
  return {
    ...temaIesPadrao,
    faixa: iesTheme?.fundo ?? temaIesPadrao.faixa,
    texto: iesTheme?.texto ?? temaIesPadrao.texto,
    acaoSecundariaTexto: iesTheme?.texto ?? temaIesPadrao.acaoSecundariaTexto,
    acao: {
      fundo: iesTheme?.acento ?? temaIesPadrao.acao.fundo,
      fundoHover: iesTheme?.acentoHover ?? temaIesPadrao.acao.fundoHover,
      texto: iesTheme?.textoAcao ?? temaIesPadrao.acao.texto,
    },
    selo: iesTheme?.selo ?? null, logo: iesTheme?.logo ?? null,
  };
}
/** Fallback de referência; em produção prevalece o cadastro da IES. */
export const temaUniAtenas: TemaContexto = {
  faixa: 'radial-gradient(circle at calc(100% - 44px) 50%, rgba(248,148,28,0.30), rgba(248,148,28,0) 130px), linear-gradient(100deg, #1A0A05 0%, #24100A 40%, #3A1203 100%)',
  faixaBorda: 'inset 0 0 0 1px rgba(248,148,28,0.14)', texto: '#F4EDE4', destaque: '#FFD6A6',
  acao: { fundo: '#F8941C', fundoHover: '#FFA83D', texto: '#140803' },
  acaoSecundariaTexto: '#FFD6A6', cartaoSidebar: '#FFF4E8', cartaoSidebarTexto: '#3A1203',
};
