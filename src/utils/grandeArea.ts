/**
 * Normalização canônica de `grande_area` (questoes_simulado).
 *
 * Espelha o que o trigger `trg_normalize_grande_area` faz no banco — mantido
 * como defesa em profundidade para o caso de variantes legadas em cache,
 * dados antigos não migrados ou novas importações que escapem do trigger.
 *
 * Regras (mesmas do SQL `public.normalize_grande_area`):
 *  - trim em todos os valores
 *  - "Ginecologia" → "Ginecologia e Obstetrícia"
 *  - "Medicina Preventiva" / "Medicina Preventiva/Saúde Coletiva" → "Preventiva"
 */
const CANONICAL_MAP: Record<string, string> = {
  Ginecologia: 'Ginecologia e Obstetrícia',
  'Medicina Preventiva': 'Preventiva',
  'Medicina Preventiva/Saúde Coletiva': 'Preventiva',
};

export function normalizeGrandeArea(raw?: string | null): string {
  if (!raw) return 'Outros';
  const trimmed = String(raw).trim();
  if (!trimmed) return 'Outros';
  return CANONICAL_MAP[trimmed] ?? trimmed;
}
