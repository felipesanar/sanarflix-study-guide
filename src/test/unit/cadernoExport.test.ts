import { describe, it, expect } from 'vitest';
import { groupCadernoByArea, type CadernoExportEntry } from '@/utils/cadernoPdfExport';

const e = (grandeArea: string | null, tema = 't'): CadernoExportEntry => ({
  grandeArea, tema, reasonLabel: 'Não sabia', learningText: null,
});

describe('groupCadernoByArea', () => {
  it('agrupa por área e ordena alfabeticamente', () => {
    const groups = groupCadernoByArea([e('Pediatria'), e('Cirurgia'), e('Pediatria')]);
    expect(groups.map((g) => g.area)).toEqual(['Cirurgia', 'Pediatria']);
    expect(groups.find((g) => g.area === 'Pediatria')!.items).toHaveLength(2);
  });

  it('coloca entradas sem área em "Sem área"', () => {
    const groups = groupCadernoByArea([e(null)]);
    expect(groups[0].area).toBe('Sem área');
  });

  it('retorna vazio para lista vazia', () => {
    expect(groupCadernoByArea([])).toEqual([]);
  });
});
