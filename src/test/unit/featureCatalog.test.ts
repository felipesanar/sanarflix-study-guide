import { describe, it, expect, vi } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { fetchFeatureCatalog, groupCatalogByExperience } from '@/services/admin/featureCatalog';

describe('featureCatalog', () => {
  it('mapeia snake_case do banco para o tipo do front, ordenado', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                { key: 'gestao.enabled', experience: 'gestao', label: 'Portal do Gestor', description: 'Master', sort_order: 100 },
                { key: 'aluno.home', experience: 'aluno', label: 'Home', description: 'Início', sort_order: 10 },
              ],
              error: null,
            }),
        }),
      }),
    });
    const catalog = await fetchFeatureCatalog();
    expect(catalog[0]).toEqual({ key: 'gestao.enabled', experience: 'gestao', label: 'Portal do Gestor', description: 'Master', sortOrder: 100 });
    const grouped = groupCatalogByExperience(catalog);
    expect(grouped.aluno.map((f) => f.key)).toEqual(['aluno.home']);
    expect(grouped.gestao.map((f) => f.key)).toEqual(['gestao.enabled']);
  });
});
