import type { CurricularBreakdown, CurricularTemaNode } from '@/types/desempenhoV2';

/** Extrai todos os temas (folhas) da árvore curricular, achatados. */
export function flattenTemas(curricular: CurricularBreakdown): CurricularTemaNode[] {
  return curricular.areas.flatMap((area) => area.specialties.flatMap((sp) => sp.temas));
}

/** Pior tema do recorte por % de acerto (menor primeiro), entre os que têm questões. */
export function getPiorTema(curricular: CurricularBreakdown): CurricularTemaNode | null {
  const temas = flattenTemas(curricular).filter((t) => t.total > 0);
  if (temas.length === 0) return null;
  return [...temas].sort((a, b) => a.percentual - b.percentual)[0];
}
