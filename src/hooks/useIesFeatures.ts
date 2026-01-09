import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AccessRules } from '@/types';

/**
 * Hook para carregar features da IES do banco de dados
 * Substitui o accessRules.ts hardcoded por configuração dinâmica
 */
export const useIesFeatures = () => {
  const { user } = useAuth();
  const [features, setFeatures] = useState<Partial<AccessRules>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id_ies) {
      loadFeatures(user.id_ies);
    } else {
      setFeatures({});
      setLoading(false);
    }
  }, [user?.id_ies]);

  const loadFeatures = async (iesId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('ies_features')
        .select('feature_key, enabled')
        .eq('ies_id', iesId);

      if (fetchError) throw fetchError;

      const featuresMap: Partial<AccessRules> = {};
      (data || []).forEach((row: { feature_key: string; enabled: boolean }) => {
        (featuresMap as Record<string, boolean>)[row.feature_key] = row.enabled;
      });

      setFeatures(featuresMap);
    } catch (err) {
      console.error('Erro ao carregar features da IES:', err);
      setError('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (featureKey: keyof AccessRules): boolean => {
    return (features as Record<string, boolean>)[featureKey] ?? false;
  };

  return {
    features,
    loading,
    error,
    hasFeature,
    refetch: () => user?.id_ies && loadFeatures(user.id_ies),
  };
};
