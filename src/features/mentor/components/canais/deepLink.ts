import { textoSeguro, tituloDeParam } from '../../lib/textoSeguro';
import type { TagMural } from '../../api/types';
import type { RascunhoMural } from './MuralCanais';

/** Parâmetros do deep link para o mural dos Canais (Diagnóstico da IA, questão → Canais). */
export const PARAMS_MURAL = ['novo', 'tag', 'titulo', 'mensagem'] as const;
export const MENSAGEM_MAX = 2000;
const TAGS: readonly TagMural[] = ['desempenho', 'aviso', 'fique_por_dentro'];

/**
 * `/mentor/canais?novo=1&tag=desempenho&titulo=…&mensagem=…` abre o composer preenchido.
 * Qualquer um dos parâmetros abre; texto da URL é sempre saneado (sem marcação, com limite).
 */
export function rascunhoDaUrl(p: URLSearchParams): RascunhoMural | null {
  if (!PARAMS_MURAL.some((k) => p.has(k))) return null;
  const tag = p.get('tag');
  const mensagem = textoSeguro(p.get('mensagem')).slice(0, MENSAGEM_MAX).trim();
  return {
    tag: TAGS.includes(tag as TagMural) ? (tag as TagMural) : undefined,
    titulo: tituloDeParam(p.get('titulo')) ?? undefined,
    mensagem: mensagem || undefined,
  };
}

/** URL do deep link (para as outras telas montarem o "Levar pro mural"). */
export function urlCanaisMural(r: RascunhoMural = {}): string {
  const p = new URLSearchParams({ novo: '1' });
  if (r.tag) p.set('tag', r.tag);
  if (r.titulo) p.set('titulo', r.titulo);
  if (r.mensagem) p.set('mensagem', r.mensagem);
  return `/mentor/canais?${p.toString()}`;
}
