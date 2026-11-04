import type { TriboId } from '@/features/mentor/api/types';

// Mesmos assets oficiais do shell (cartão da sidebar), usados no cabeçalho do mural visto pelo aluno.
const ICONES: Record<TriboId, string> = {
  carcara: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-carcara.png', import.meta.url).href,
  camaleao: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-camaleao.png', import.meta.url).href,
  colmeia: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-colmeia.png', import.meta.url).href,
  octopus: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-octopus.png', import.meta.url).href,
};

/** Ícone cadastrado da tribo; sem cadastro, o asset oficial pelo slug; sem nenhum, `null`. */
export function iconeDaTribo(tribo: { iconeUrl?: string | null; slug?: string | null } | undefined): string | null {
  if (tribo?.iconeUrl) return tribo.iconeUrl;
  const slug = tribo?.slug;
  return slug && Object.prototype.hasOwnProperty.call(ICONES, slug) ? ICONES[slug as TriboId] : null;
}
