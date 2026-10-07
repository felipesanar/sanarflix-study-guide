import type { ProvaOficialAluno, QuestaoProvaOficial } from '../types';

export type FiltroQuestoes = { tipo: 'todas' | 'erradas' | 'em_branco'; area: string | null };

export function filtrarQuestoes(questoes: QuestaoProvaOficial[], filtro: FiltroQuestoes): QuestaoProvaOficial[] {
  return questoes.filter((q) => {
    if (filtro.area && q.grandeArea !== filtro.area) return false;
    if (filtro.tipo === 'erradas') return !q.anulada && !q.acertou && q.resposta !== null;
    if (filtro.tipo === 'em_branco') return !q.anulada && q.resposta === null;
    return true;
  });
}

export function destaquesPorArea(areas: ProvaOficialAluno['areas']): { melhor: string | null; maisFraca: string | null } {
  const validas = areas.filter((a) => a.total > 0);
  if (validas.length === 0) return { melhor: null, maisFraca: null };
  const pct = (a: { acertos: number; total: number }) => a.acertos / a.total;
  const ordenadas = [...validas].sort((a, b) => pct(b) - pct(a) || b.total - a.total);
  return { melhor: ordenadas[0].area, maisFraca: ordenadas[ordenadas.length - 1].area };
}
