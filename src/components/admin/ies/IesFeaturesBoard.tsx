import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AdminLoading, AdminError, AdminEmpty, MonoValue } from '@/experiences/admin/ui';
import { cn } from '@/lib/utils';
import { AccessRules } from '@/types';
import { Logger } from '@/utils/logger';
import { setIesFeatures } from '@/services/admin/iesFeatures';

interface IesData {
  id: string;
  nome: string;
  features: Record<keyof AccessRules, boolean>;
}

/** Features configuráveis por IES (9 — `userManagement` fica fora, é controle interno). */
const AVAILABLE_FEATURES: { key: keyof AccessRules; label: string; description: string }[] = [
  { key: 'home', label: 'Home', description: 'Página inicial com resumo' },
  { key: 'studyGuide', label: 'Guia de Estudos', description: 'Conteúdos organizados por matéria' },
  { key: 'dashboard', label: 'Dashboard', description: 'Métricas e progresso do aluno' },
  { key: 'SimuladoDesempenho', label: 'Desempenho Simulados', description: 'Análise detalhada de simulados' },
  { key: 'sanarclass', label: 'SanarClass', description: 'Aulas e materiais complementares' },
  { key: 'simulados', label: 'Simulados', description: 'Acesso aos simulados' },
  { key: 'analytics', label: 'Analytics', description: 'Estatísticas avançadas' },
  { key: 'desempenhoInstitucional', label: 'Desempenho Institucional', description: 'Painel institucional (v2) com KPIs e evolução' },
  { key: 'errorNotebook', label: 'Caderno de Erros', description: 'Registro de erros para revisão' },
];

const TOTAL_FEATURES = AVAILABLE_FEATURES.length;

async function loadIesData(): Promise<IesData[]> {
  const { data: iesRows, error: iesError } = await supabase.from('ies').select('id, nome').order('nome');
  if (iesError) throw iesError;

  const { data: featuresRows, error: featuresError } = await supabase
    .from('ies_features')
    .select('ies_id, feature_key, enabled');
  if (featuresError) throw featuresError;

  const featuresMap: Record<string, Record<string, boolean>> = {};
  (featuresRows || []).forEach((f) => {
    if (!featuresMap[f.ies_id]) featuresMap[f.ies_id] = {};
    featuresMap[f.ies_id][f.feature_key] = f.enabled;
  });

  return (iesRows || []).map((ies) => {
    const features: Record<string, boolean> = {};
    AVAILABLE_FEATURES.forEach((f) => {
      features[f.key] = featuresMap[ies.id]?.[f.key] ?? false;
    });
    return { id: ies.id, nome: ies.nome, features: features as Record<keyof AccessRules, boolean> };
  });
}

/**
 * Cards por IES com switches das 9 features configuráveis. Diff local +
 * "Salvar" por IES via RPC `admin_set_ies_features` (transacional, com
 * auditoria) — substitui o antigo loop client-side de upserts.
 *
 * Contagem de alunos por IES foi deliberadamente omitida: `get_ies_student_count`
 * é uma RPC por IES (sem versão em lote) — chamá-la uma vez por card viraria
 * N chamadas paralelas a cada carregamento da tela. Ver relatório da fatia E.
 */
export const IesFeaturesBoard: React.FC = () => {
  const [iesList, setIesList] = useState<IesData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, boolean>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadIesData();
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

  const getFeatureValue = (iesId: string, featureKey: string, originalValue: boolean): boolean =>
    pendingChanges[iesId]?.[featureKey] ?? originalValue;

  const hasChanges = (iesId: string): boolean => Object.keys(pendingChanges[iesId] || {}).length > 0;

  const saveChanges = async (iesId: string) => {
    const changes = pendingChanges[iesId];
    if (!changes || Object.keys(changes).length === 0) return;

    setSaving(iesId);
    try {
      await setIesFeatures(iesId, changes);
      toast.success('Configurações salvas com sucesso!');

      setIesList((prev) =>
        (prev ?? []).map((ies) => {
          if (ies.id !== iesId) return ies;
          const updatedFeatures = { ...ies.features };
          Object.entries(changes).forEach(([key, value]) => {
            updatedFeatures[key as keyof AccessRules] = value;
          });
          return { ...ies, features: updatedFeatures };
        }),
      );

      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[iesId];
        return next;
      });
    } catch (err) {
      Logger.error('Erro ao salvar features da IES:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(null);
    }
  };

  const countEnabledFeatures = (ies: IesData): number =>
    AVAILABLE_FEATURES.filter((f) => getFeatureValue(ies.id, f.key, ies.features[f.key])).length;

  if (loading) return <AdminLoading rows={3} rowHeight="h-40" />;
  if (error) return <AdminError message={error} onRetry={load} />;
  if (!iesList || iesList.length === 0) {
    return <AdminEmpty title="Nenhuma IES cadastrada" description="Cadastre uma IES para configurar suas features." />;
  }

  return (
    <div className="grid gap-4">
      {iesList.map((ies) => {
        const pending = hasChanges(ies.id);
        return (
          <div
            key={ies.id}
            className={cn(
              'space-y-4 rounded-xl border p-4 transition-colors',
              pending && 'border-primary',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">{ies.nome}</span>
                <MonoValue muted className="text-xs">
                  {countEnabledFeatures(ies)}/{TOTAL_FEATURES} features
                </MonoValue>
              </div>
              <Button size="sm" onClick={() => saveChanges(ies.id)} disabled={!pending || saving === ies.id}>
                {saving === ies.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {AVAILABLE_FEATURES.map((feature) => {
                const isEnabled = getFeatureValue(ies.id, feature.key, ies.features[feature.key]);
                const changed = pendingChanges[ies.id]?.[feature.key] !== undefined;
                return (
                  <div
                    key={feature.key}
                    className={cn(
                      'flex items-start justify-between gap-3 rounded-lg border p-3',
                      changed ? 'border-primary/40 bg-primary/5' : 'bg-muted/30',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`${ies.id}-${feature.key}`} className="cursor-pointer text-sm font-medium">
                        {feature.label}
                      </Label>
                      <p className="truncate text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                    <Switch
                      id={`${ies.id}-${feature.key}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleFeatureToggle(ies.id, feature.key, checked)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
