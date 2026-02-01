import * as React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Building2, Save, RefreshCw, Check, X } from 'lucide-react';
import { AccessRules } from '@/types';

interface IesData {
  id: string;
  nome: string;
  features: Record<keyof AccessRules, boolean>;
}

// Features disponíveis para configuração por IES
const AVAILABLE_FEATURES: { key: keyof AccessRules; label: string; description: string }[] = [
  { key: 'home', label: 'Home', description: 'Página inicial com resumo' },
  { key: 'studyGuide', label: 'Guia de Estudos', description: 'Conteúdos organizados por matéria' },
  { key: 'dashboard', label: 'Dashboard', description: 'Métricas e progresso do aluno' },
  { key: 'SimuladoDesempenho', label: 'Desempenho Simulados', description: 'Análise detalhada de simulados' },
  { key: 'sanarclass', label: 'SanarClass', description: 'Aulas e materiais complementares' },
  { key: 'simulados', label: 'Simulados', description: 'Acesso aos simulados' },
  { key: 'analytics', label: 'Analytics', description: 'Estatísticas avançadas' },
];

const IesFeaturesTab: React.FC = () => {
  const [iesList, setIesList] = useState<IesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    loadIesData();
  }, []);

  const loadIesData = async () => {
    setLoading(true);
    try {
      // Buscar todas as IES
      const { data: iesData, error: iesError } = await supabase
        .from('ies')
        .select('id, nome')
        .order('nome');

      if (iesError) throw iesError;

      // Buscar features de cada IES
      const { data: featuresData, error: featuresError } = await supabase
        .from('ies_features')
        .select('ies_id, feature_key, enabled');

      if (featuresError) throw featuresError;

      // Mapear features por IES
      const featuresMap: Record<string, Record<string, boolean>> = {};
      (featuresData || []).forEach((f) => {
        if (!featuresMap[f.ies_id]) {
          featuresMap[f.ies_id] = {};
        }
        featuresMap[f.ies_id][f.feature_key] = f.enabled;
      });

      // Montar lista final
      const formattedList: IesData[] = (iesData || []).map((ies) => {
        const features: Record<string, boolean> = {};
        AVAILABLE_FEATURES.forEach((f) => {
          features[f.key] = featuresMap[ies.id]?.[f.key] ?? false;
        });
        return {
          id: ies.id,
          nome: ies.nome,
          features: features as Record<keyof AccessRules, boolean>,
        };
      });

      setIesList(formattedList);
      setPendingChanges({});
    } catch (error) {
      console.error('Erro ao carregar IES:', error);
      toast.error('Erro ao carregar lista de IES');
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureToggle = (iesId: string, featureKey: string, enabled: boolean) => {
    setPendingChanges((prev) => ({
      ...prev,
      [iesId]: {
        ...prev[iesId],
        [featureKey]: enabled,
      },
    }));
  };

  const getFeatureValue = (iesId: string, featureKey: string, originalValue: boolean): boolean => {
    return pendingChanges[iesId]?.[featureKey] ?? originalValue;
  };

  const hasChanges = (iesId: string): boolean => {
    return Object.keys(pendingChanges[iesId] || {}).length > 0;
  };

  const saveChanges = async (iesId: string) => {
    const changes = pendingChanges[iesId];
    if (!changes || Object.keys(changes).length === 0) return;

    setSaving(iesId);
    try {
      for (const [featureKey, enabled] of Object.entries(changes)) {
        // Tentar atualizar primeiro
        const { data: existing } = await supabase
          .from('ies_features')
          .select('id')
          .eq('ies_id', iesId)
          .eq('feature_key', featureKey)
          .single();

        if (existing) {
          // Atualizar
          const { error } = await supabase
            .from('ies_features')
            .update({ enabled, updated_at: new Date().toISOString() })
            .eq('ies_id', iesId)
            .eq('feature_key', featureKey);

          if (error) throw error;
        } else {
          // Inserir
          const { error } = await supabase
            .from('ies_features')
            .insert({ ies_id: iesId, feature_key: featureKey, enabled });

          if (error) throw error;
        }
      }

      toast.success('Configurações salvas com sucesso!');
      
      // Atualizar estado local
      setIesList((prev) =>
        prev.map((ies) => {
          if (ies.id !== iesId) return ies;
          const updatedFeatures = { ...ies.features };
          Object.entries(changes).forEach(([key, value]) => {
            updatedFeatures[key as keyof AccessRules] = value;
          });
          return { ...ies, features: updatedFeatures };
        })
      );

      // Limpar pending changes desta IES
      setPendingChanges((prev) => {
        const newChanges = { ...prev };
        delete newChanges[iesId];
        return newChanges;
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(null);
    }
  };

  const countEnabledFeatures = (iesId: string, features: Record<keyof AccessRules, boolean>): number => {
    return AVAILABLE_FEATURES.filter((f) => getFeatureValue(iesId, f.key, features[f.key])).length;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Gerenciamento de Features por IES
          </h2>
          <p className="text-muted-foreground">
            Configure quais funcionalidades estão disponíveis para cada instituição
          </p>
        </div>
        <Button variant="outline" onClick={loadIesData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4">
        {iesList.map((ies) => (
          <Card key={ies.id} className={hasChanges(ies.id) ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {ies.nome}
                    {hasChanges(ies.id) && (
                      <Badge variant="outline" className="text-xs">
                        Alterações pendentes
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {countEnabledFeatures(ies.id, ies.features)} de {AVAILABLE_FEATURES.length} features ativas
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => saveChanges(ies.id)}
                  disabled={!hasChanges(ies.id) || saving === ies.id}
                  className="gap-2"
                >
                  {saving === ies.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {AVAILABLE_FEATURES.map((feature) => {
                  const isEnabled = getFeatureValue(ies.id, feature.key, ies.features[feature.key]);
                  const hasChanged = pendingChanges[ies.id]?.[feature.key] !== undefined;

                  return (
                    <div
                      key={feature.key}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        hasChanged ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={`${ies.id}-${feature.key}`}
                          className="text-sm font-medium cursor-pointer flex items-center gap-2"
                        >
                          {feature.label}
                          {isEnabled ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <X className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Label>
                        <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
                      </div>
                      <Switch
                        id={`${ies.id}-${feature.key}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          handleFeatureToggle(ies.id, feature.key, checked)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default IesFeaturesTab;
