import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { hasExperience } from '@/experiences/access';
import { AccessRules } from '@/types';

const NO_ACCESS: AccessRules = {
  home: false, studyGuide: false, dashboard: false, SimuladoDesempenho: false,
  userManagement: false, sanarclass: false, simulados: false,
  desempenhoInstitucional: false, errorNotebook: false,
};

/**
 * Adaptador fino da fonte única (`get_effective_features`) para a interface
 * `AccessRules` consumida por rotas/sidebar/bottom-nav.
 *
 * Nenhum role é interpretado aqui para as chaves `aluno.*` — o bypass
 * (admin/atendimento) é decidido no servidor. Semânticas:
 * - `desempenhoInstitucional` == papel de gestor (`hasExperience(access, 'gestao')`).
 *   O portal do gestor deixou de ser liberado por IES (spec 2026-08-07): todo
 *   gestor tem acesso completo, sempre. O nome do campo é legado de quando
 *   isto era a feature `gestao.enabled`.
 * - `userManagement` == bypass (equipe interna Sanar).
 */
export const useAccessRules = () => {
  const { user, access } = useAuth();
  const { features, bypass, loading, refetching, error, hasFeature, refetch } = useEffectiveFeatures();

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
      // Papel, não feature. O portal do gestor deixou de ser liberado por IES
      // (spec 2026-08-07): todo gestor tem acesso completo, sempre. O nome do
      // campo é legado de quando isto era a feature `gestao.enabled`.
      desempenhoInstitucional: hasExperience(access, 'gestao'),
      userManagement: bypass,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasFeature deriva de features
  }, [user, access, features, bypass]);

  return { accessRules, loading, refetching, error, hasFeature, refetch };
};
