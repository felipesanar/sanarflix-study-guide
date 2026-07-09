import { describe, it, expect } from 'vitest';
import { GESTOR_NAV, filterGestorNav } from '@/experiences/gestor/GestorNav';
import type { Access } from '@/experiences/access';

const gestorAccess: Access = {
  experiences: ['aluno', 'gestao'],
  capabilities: ['institutional.view', 'alunos.view'],
} as Access;

describe('GestorNav com gates por feature', () => {
  it('todo item de nav declara featureKey gestao.*', () => {
    for (const item of GESTOR_NAV) {
      expect(item.featureKey, `item ${item.url} sem featureKey`).toMatch(/^gestao\./);
    }
  });

  it('filterGestorNav corta itens sem feature ligada', () => {
    const hasFeature = (key: string) => key === 'gestao.alunos';
    const items = filterGestorNav(GESTOR_NAV, gestorAccess, hasFeature);
    expect(items.map((i) => i.url)).toEqual(['/gestor/alunos']);
  });
});
