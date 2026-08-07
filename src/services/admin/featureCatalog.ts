import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/utils/networkRetry';

/** Entrada do catálogo de features (`feature_catalog`) — a tela /admin/ies renderiza a partir daqui. */
export interface FeatureCatalogEntry {
  key: string;
  experience: 'aluno' | 'gestao';
  label: string;
  description: string;
  sortOrder: number;
  isMaster: boolean;
}

interface FeatureCatalogRow {
  key: string;
  experience: 'aluno' | 'gestao';
  label: string;
  description: string;
  sort_order: number;
  is_master: boolean;
}

/**
 * `feature_catalog` ainda não está nos tipos gerados do Supabase — cast local
 * documentado (mesmo padrão de `src/services/admin/iesFeatures.ts`).
 */
export async function fetchFeatureCatalog(): Promise<FeatureCatalogEntry[]> {
  return withRetry(async () => {
    const { data, error } = await (
      supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, v: boolean) => {
              order: (col: string) => PromiseLike<{ data: FeatureCatalogRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      }
    )
      .from('feature_catalog')
      .select('key, experience, label, description, sort_order, is_master')
      .eq('active', true)
      .order('sort_order');
    if (error) throw new Error(`feature_catalog: ${error.message}`);
    return (data ?? []).map((row) => ({
      key: row.key,
      experience: row.experience,
      label: row.label,
      description: row.description,
      sortOrder: row.sort_order,
      isMaster: row.is_master,
    }));
  });
}

/** Catálogo agrupado por experiência (preservando a ordem de sort_order). */
export function groupCatalogByExperience(
  catalog: FeatureCatalogEntry[],
): { aluno: FeatureCatalogEntry[]; gestao: FeatureCatalogEntry[] } {
  return {
    aluno: catalog.filter((f) => f.experience === 'aluno'),
    gestao: catalog.filter((f) => f.experience === 'gestao'),
  };
}
