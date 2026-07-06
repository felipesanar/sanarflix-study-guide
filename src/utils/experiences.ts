import { AccessRules, User } from '@/types';
import { isAdmin, isAtendimento, isGestor } from '@/utils/accessRules';

/**
 * Experiências apartadas do SanarFlix Academy (v0).
 *
 * Cada usuário autenticado é roteado para UMA das quatro experiências
 * conforme a sua role. Ver "Plano de migração — experiências apartadas"
 * na Central do SanarFlix Academy (Notion).
 *
 *  1. `aluno_professor` — Aluno + Professor
 *  2. `gestao`          — Gestor IES + Gestor de Grupo
 *  3. `admin`           — Admin
 *  4. `atendimento`     — Atendimento (CX)
 */
export type Experience = 'aluno_professor' | 'gestao' | 'admin' | 'atendimento';

/**
 * Resolve a experiência do usuário a partir das suas roles.
 *
 * Precedência (usuário com múltiplas roles cai na de maior poder):
 *   admin > atendimento > gestor / gestor_grupo (gestão) > professor / aluno
 *
 * Fallback: usuário sem role especial (ou sem roles) → experiência
 * Aluno + Professor, que é a base mínima equivalente a um aluno padrão.
 */
export const getExperience = (user: User | null): Experience => {
  if (isAdmin(user)) return 'admin';
  if (isAtendimento(user)) return 'atendimento';
  if (isGestor(user)) return 'gestao'; // cobre 'gestor' e 'gestor_grupo'
  // professor e aluno compartilham a experiência (1); é também o fallback.
  return 'aluno_professor';
};

/**
 * Autorização de acesso a uma experiência DEDICADA, baseada em role (não na
 * experiência única de maior poder). É a fronteira usada pelo ExperienceGuard:
 * no modelo híbrido, o usuário tem a experiência de aluno na base E, por cima,
 * a(s) experiência(s) dedicada(s) que a(s) sua(s) role(s) concede(m).
 *
 * A base (aluno_professor) é acessível a todo usuário autenticado.
 */
export const canAccessExperience = (
  user: User | null,
  experience: Experience,
): boolean => {
  switch (experience) {
    case 'admin':
      return isAdmin(user);
    case 'atendimento':
      return isAtendimento(user);
    case 'gestao':
      // Admin é super usuário: além do seu portal, enxerga a experiência de
      // gestão (Desempenho Institucional / Visão Institucional) para demos e
      // suporte. Gestor e gestor_grupo mantêm o acesso por role própria.
      return isGestor(user) || isAdmin(user);
    case 'aluno_professor':
      return true;
  }
};

/**
 * Rota de entrada (entrypoint) fixa por experiência.
 *
 * A experiência Aluno + Professor não tem entrypoint fixo: a sua "home"
 * depende das telas liberadas para a IES (ies_features) e é resolvida
 * dinamicamente por {@link getDefaultRouteForUser}.
 *
 * Cada entrypoint abaixo é sempre uma tela liberada para a respectiva
 * experiência (ver getAccessRules), o que evita loop de redirecionamento.
 */
export const EXPERIENCE_ENTRYPOINTS: Record<
  Exclude<Experience, 'aluno_professor'>,
  string
> = {
  admin: '/admin/usuarios',
  atendimento: '/atendimento/usuarios',
  gestao: '/gestor',
};

/**
 * Rota inicial pós-login: roteia cada usuário para a SUA experiência apartada.
 *
 * - admin / atendimento / gestão → entrypoint fixo da experiência
 * - aluno + professor → primeira tela liberada (home → simulados → guia →
 *   dashboard → sanarclass), preservando o comportamento dinâmico baseado
 *   em ies_features que já existia.
 *
 * É usada como destino padrão em todos os redirecionamentos do roteador
 * (login, raiz e bloqueio de acesso cruzado), garantindo que cada role
 * "caia na sua experiência" e que tentativas de acesso fora dela voltem
 * para o entrypoint correto.
 */
export const getDefaultRouteForUser = (
  user: User | null,
  accessRules: AccessRules,
): string => {
  const experience = getExperience(user);

  if (experience !== 'aluno_professor') {
    return EXPERIENCE_ENTRYPOINTS[experience];
  }

  if (accessRules.home) return '/';
  if (accessRules.simulados) return '/simulados';
  if (accessRules.studyGuide) return '/guia-estudos';
  if (accessRules.dashboard) return '/dashboard';
  if (accessRules.sanarclass) return '/sanarclass';
  return '/home';
};
