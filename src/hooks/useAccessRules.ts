import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIesFeatures } from '@/hooks/useIesFeatures';
import { getAccessRules, isAdmin, isProfessor, isGestor, isAtendimento } from '@/utils/accessRules';
import { AccessRules } from '@/types';

/**
 * Hook que combina as regras de acesso base (accessRules.ts)
 * com as features dinâmicas da IES (tabela ies_features).
 * 
 * Hierarquia de permissões:
 * 1. Admin → acesso total (não usa ies_features)
 * 2. Professor → regras de professor (não usa ies_features)
 * 3. Aluno B2B → regras base + features da IES via banco de dados
 * 
 * Este hook deve ser usado em vez de getAccessRules() diretamente
 * quando você precisar das permissões combinadas com ies_features.
 */
export const useAccessRules = () => {
  const { user } = useAuth();
  const { features, loading: featuresLoading, hasFeature } = useIesFeatures();

  const accessRules = useMemo<AccessRules>(() => {
    // Regras base do usuário
    const baseRules = getAccessRules(user);

    // Admin e Professor não usam ies_features - retorna regras base
    if (!user || isAdmin(user) || isProfessor(user) || isGestor(user) || isAtendimento(user)) {
      return baseRules;
    }

    // Aluno B2B: combinar regras base com features da IES
    // As features do banco sobrescrevem as regras padrão
    return {
      ...baseRules,
      home: hasFeature('home'),
      studyGuide: hasFeature('studyGuide'),
      dashboard: hasFeature('dashboard'),
      SimuladoDesempenho: hasFeature('SimuladoDesempenho'),
      sanarclass: hasFeature('sanarclass'),
      analytics: hasFeature('analytics'),
      desempenhoInstitucional: hasFeature('desempenhoInstitucional'),
      errorNotebook: hasFeature('errorNotebook'),
      // simulados controlado pela IES (via ies_features)
      simulados: hasFeature('simulados'),
      // userManagement nunca para alunos (regra base)
      userManagement: baseRules.userManagement,
    };
  }, [user, features, hasFeature]);

  return {
    accessRules,
    loading: featuresLoading,
    hasFeature,
  };
};
