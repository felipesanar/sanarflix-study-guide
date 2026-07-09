import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { AdminLoading, AdminError, AdminEmpty } from '@/experiences/admin/ui';
import { Logger } from '@/utils/logger';
import { setIesFeatures } from '@/services/admin/iesFeatures';
import {
  fetchFeatureCatalog,
  groupCatalogByExperience,
  type FeatureCatalogEntry,
} from '@/services/admin/featureCatalog';
import { IesFeatureCard } from '@/components/admin/ies/IesFeatureCard';

export interface IesData {
  id: string;
  nome: string;
  /** Chave → valor, indexado pelas chaves do `feature_catalog` (`aluno.*` / `gestao.*`). */
  features: Record<string, boolean>;
}

/** Remove acentos e normaliza para minúsculas — busca "case/acento-insensitive". */
function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

async function loadAll(): Promise<{ catalog: FeatureCatalogEntry[]; iesList: IesData[] }> {
  // As três fontes são independentes entre si — carregadas em paralelo.
  const [catalog, { data: iesRows, error: iesError }, { data: featuresRows, error: featuresError }] = await Promise.all([
    fetchFeatureCatalog(),
    supabase.from('ies').select('id, nome').order('nome'),
    supabase.from('ies_features').select('ies_id, feature_key, enabled'),
  ]);
  if (iesError) throw iesError;
  if (featuresError) throw featuresError;

  const featuresMap: Record<string, Record<string, boolean>> = {};
  (featuresRows || []).forEach((f) => {
    if (!featuresMap[f.ies_id]) featuresMap[f.ies_id] = {};
    featuresMap[f.ies_id][f.feature_key] = f.enabled;
  });

  const iesList = (iesRows || []).map((ies) => {
    const features: Record<string, boolean> = {};
    catalog.forEach((entry) => {
      features[entry.key] = featuresMap[ies.id]?.[entry.key] ?? false;
    });
    return { id: ies.id, nome: ies.nome, features };
  });

  return { catalog, iesList };
}

/**
 * Orquestrador de `/admin/ies`: busca + lista de `IesFeatureCard`, um por IES.
 * Cards renderizam a partir do catálogo do banco (`feature_catalog`, Task 0) —
 * não há mais lista hardcoded de features. Diff local + "Salvar" por IES via
 * RPC `admin_set_ies_features` (transacional, com auditoria) é preservado
 * integralmente (snapshot `sentKeys`, patch otimista) — ver `saveChanges`.
 *
 * Contagem de alunos por IES foi deliberadamente omitida: `get_ies_student_count`
 * é uma RPC por IES (sem versão em lote) — chamá-la uma vez por card viraria
 * N chamadas paralelas a cada carregamento da tela. Ver relatório da fatia E.
 */
export const IesFeaturesBoard: React.FC = () => {
  const [iesList, setIesList] = useState<IesData[] | null>(null);
  const [catalog, setCatalog] = useState<FeatureCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { catalog: catalogData, iesList: data } = await loadAll();
      setCatalog(catalogData);
      setIesList(data);
      setPendingChanges({});
    } catch (err) {
      Logger.error('Erro ao carregar IES:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar lista de IES');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFeatureToggle = (iesId: string, featureKey: string, enabled: boolean) => {
    setPendingChanges((prev) => ({
      ...prev,
      [iesId]: { ...prev[iesId], [featureKey]: enabled },
    }));
  };

  const getFeatureValue = useCallback(
    (iesId: string, featureKey: string, originalValue: boolean): boolean =>
      pendingChanges[iesId]?.[featureKey] ?? originalValue,
    [pendingChanges],
  );

  const saveChanges = async (iesId: string) => {
    const changes = pendingChanges[iesId];
    if (!changes || Object.keys(changes).length === 0) return;

    // Snapshot das chaves enviadas nesse payload — usado depois para remover
    // do pending SÓ o que foi de fato salvo, preservando toggles feitos pelo
    // usuário enquanto a RPC estava em voo.
    const sentKeys = Object.keys(changes);

    setSaving(iesId);
    try {
      await setIesFeatures(iesId, changes);
      toast.success('Configurações salvas com sucesso!');

      setIesList((prev) =>
        (prev ?? []).map((ies) => {
          if (ies.id !== iesId) return ies;
          const updatedFeatures = { ...ies.features };
          Object.entries(changes).forEach(([key, value]) => {
            updatedFeatures[key] = value;
          });
          return { ...ies, features: updatedFeatures };
        }),
      );

      setPendingChanges((prev) => {
        const iesChanges = prev[iesId];
        if (!iesChanges) return prev;
        const next = { ...prev };
        const remaining = { ...iesChanges };
        // Remove só as chaves que estavam neste payload — um toggle feito
        // DURANTE a RPC em voo (chave ainda não presente em `sentKeys`)
        // permanece pendente, em vez de ser descartado silenciosamente.
        sentKeys.forEach((key) => delete remaining[key]);
        if (Object.keys(remaining).length === 0) {
          delete next[iesId];
        } else {
          next[iesId] = remaining;
        }
        return next;
      });
    } catch (err) {
      Logger.error('Erro ao salvar features da IES:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(null);
    }
  };

  /**
   * Copiar-de: pega o estado efetivo (original + pending) da IES fonte e
   * grava como pendingChanges da IES destino APENAS as chaves que diferem do
   * estado atual (também efetivo) do destino — nada é salvo direto, vira diff
   * pendente igual a qualquer outro toggle manual.
   */
  const handleCopyFrom = (destIesId: string, sourceIesId: string) => {
    const source = (iesList ?? []).find((ies) => ies.id === sourceIesId);
    const dest = (iesList ?? []).find((ies) => ies.id === destIesId);
    if (!source || !dest) return;

    const diff: Record<string, boolean> = {};
    catalog.forEach((entry) => {
      const sourceEffective = getFeatureValue(sourceIesId, entry.key, source.features[entry.key] ?? false);
      const destEffective = getFeatureValue(destIesId, entry.key, dest.features[entry.key] ?? false);
      if (sourceEffective !== destEffective) {
        diff[entry.key] = sourceEffective;
      }
    });

    if (Object.keys(diff).length === 0) {
      toast.info('Nenhuma diferença entre as IES.');
      return;
    }

    setPendingChanges((prev) => ({
      ...prev,
      [destIesId]: { ...prev[destIesId], ...diff },
    }));
    toast.success(`${Object.keys(diff).length} feature(s) marcada(s) como pendente(s).`);
  };

  const groupedCatalog = useMemo(() => groupCatalogByExperience(catalog), [catalog]);

  const filteredIesList = useMemo(() => {
    if (!iesList) return [];
    const term = normalizeSearchTerm(search.trim());
    if (!term) return iesList;
    return iesList.filter((ies) => normalizeSearchTerm(ies.nome).includes(term));
  }, [iesList, search]);

  if (loading) return <AdminLoading rows={3} rowHeight="h-40" />;
  if (error) return <AdminError message={error} onRetry={load} />;
  if (!iesList || iesList.length === 0) {
    return <AdminEmpty title="Nenhuma IES cadastrada" description="Cadastre uma IES para configurar suas features." />;
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar IES..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredIesList.length === 0 ? (
        <AdminEmpty title="Nenhuma IES encontrada" description="Ajuste o termo de busca." />
      ) : (
        <div className="grid gap-4">
          {filteredIesList.map((ies) => (
            <IesFeatureCard
              key={ies.id}
              ies={ies}
              catalog={groupedCatalog}
              pending={pendingChanges[ies.id]}
              saving={saving === ies.id}
              iesList={iesList}
              onToggle={(featureKey, enabled) => handleFeatureToggle(ies.id, featureKey, enabled)}
              onSave={() => saveChanges(ies.id)}
              onCopyFrom={(sourceIesId) => handleCopyFrom(ies.id, sourceIesId)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
