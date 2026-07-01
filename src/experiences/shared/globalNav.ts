import { UserCog, TrendingUp, School, Users } from 'lucide-react';
import type { AccessRules, User } from '@/types';
import { getExperience } from '@/utils/experiences';
import { ALUNO_NAV } from '@/experiences/aluno/AlunoNav';
import { filterNavByAccess, type NavItem } from '@/experiences/types';

/**
 * Navegação global (rail lateral / bottom-nav) da experiência do usuário.
 *
 * Como o {@link buildAppRoutes} monta apenas as rotas da experiência de cada
 * usuário, a nav global precisa ser **experience-aware**: cada experiência só
 * expõe links cujas rotas ela realmente monta — do contrário o link cai no
 * catch-all (NotFound). A navegação profunda de admin/gestão vive nas abas do
 * próprio layout (`AdminLayout`/`GestorLayout`); aqui ficam apenas os pontos de
 * entrada da experiência.
 *
 * Aluno + Professor mantém a lista canônica ({@link ALUNO_NAV}) filtrada pelas
 * `ies_features` (AccessRules), já que estas rotas são todas montadas na sua
 * experiência.
 */
export const getGlobalNav = (
  user: User | null,
  accessRules: AccessRules,
): NavItem[] => {
  switch (getExperience(user)) {
    case 'admin':
      return [
        { title: 'Portal do Admin', url: '/admin/usuarios', icon: UserCog },
        { title: 'Analytics', url: '/admin/analytics', icon: TrendingUp },
      ];
    case 'gestao':
      // Somente o Desempenho Institucional. O acesso do gestor a Simulados
      // (accessRules.simulados) não tem rota na experiência de gestão — ver
      // nota de revisão; se for para reexpor, montar /simulados em gestorRoutes.
      return [
        { title: 'Desempenho Institucional', url: '/gestor', icon: School },
      ];
    case 'atendimento':
      return [{ title: 'Usuários', url: '/atendimento/usuarios', icon: Users }];
    default:
      return filterNavByAccess(ALUNO_NAV, accessRules);
  }
};
