import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { AccessRules } from '@/types';

const NO_ACCESS: AccessRules = {
  home: false, studyGuide: false, dashboard: false, SimuladoDesempenho: false,
  userManagement: false, sanarclass: false, simulados: false, analytics: false,
  desempenhoInstitucional: false, errorNotebook: false,
};

/**
 * Adaptador fino da fonte única (`get_effective_features`) para a interface
 * `AccessRules` consumida por rotas/sidebar/bottom-nav.
 *
 * Nenhum role é interpretado aqui — o bypass (admin/atendimento) é decidido
 * no servidor. Semânticas:
 * - `desempenhoInstitucional` == `gestao.enabled` (gate do portal do gestor);
 * - `analytics` é flag morto (sempre false; sai da interface no cleanup);
 * - `userManagement` == bypass (equipe interna Sanar).
 */
export const useAccessRules = () => {
  const { user } = useAuth();
  const { features, bypass, loading, error, hasFeature, refetch } = useEffectiveFeatures();

  const accessRules = useMemo<AccessRules>(() => {
    if (!user) return NO_ACCESS;
    return {
      home: hasFeature('aluno.home'),
      studyGuide: hasFeature('aluno.guia_estudos'),
      dashboard: hasFeature('aluno.dashboard'),
      simulados: hasFeature('aluno.simulados'),
      SimuladoDesempenho: hasFeature('aluno.desempenho_simulados'),
      sanarclass: hasFeature('aluno.sanarclass'),
      errorNotebook: hasFeature('aluno.caderno_erros'),
      desempenhoInstitucional: hasFeature('gestao.enabled'),
      analytics: false,
      userManagement: bypass,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasFeature deriva de features
  }, [user, features, bypass]);

  return { accessRules, loading, error, hasFeature, refetch };
};
