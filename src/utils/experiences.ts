import { AccessRules, User } from '@/types';
import type { Access, ExperienceId } from '@/experiences/access';

/**
 * Experiências apartadas do SanarFlix Academy (v0).
 *
 * Duas dimensões ortogonais (ver `src/experiences/access.ts`):
 *  - Experiência: qual portal/árvore de rota o usuário acessa (aditivo — um
 *    usuário pode ter várias; `'aluno'` é a base de TODO usuário autenticado).
 *  - Capability: o que as telas mostram (não tratado aqui).
 *
 * Este módulo resolve apenas a ROTA DEFAULT pós-login a partir de
 * `access.experiences` — a montagem/guard das árvores de rota usam
 * {@link hasExperience} diretamente (ver buildAppRoutes, ExperienceGuard).
 */
export type { ExperienceId };

/**
 * Rota de entrada (entrypoint) fixa por experiência dedicada.
 *
 * A experiência `aluno` não tem entrypoint fixo: a sua "home" depende das
 * telas liberadas para a IES (ies_features) e é resolvida dinamicamente por
 * {@link getDefaultRouteForUser}.
 *
 * Cada entrypoint abaixo é sempre uma tela liberada para a respectiva
 * experiência (ver getAccessRules), o que evita loop de redirecionamento.
 */
export const EXPERIENCE_ENTRYPOINTS: Record<Exclude<ExperienceId, 'aluno'>, string> = {
  admin: '/admin',
  atendimento: '/atendimento/usuarios',
  gestao: '/gestor',
};

/** Ordem de precedência das experiências dedicadas para a rota default pós-login. */
const ENTRYPOINT_PRECEDENCE: Exclude<ExperienceId, 'aluno'>[] = [
  'admin',
  'atendimento',
  'gestao',
];

/**
 * Rota inicial pós-login: roteia cada usuário para a SUA experiência apartada.
 *
 * Precedência (usuário com múltiplas experiências cai na de maior poder):
 *   admin > atendimento > gestao > aluno
 *
 * - admin / atendimento / gestão → entrypoint fixo da experiência
 * - aluno → primeira tela liberada (home → simulados → guia → dashboard →
 *   sanarclass), preservando o comportamento dinâmico baseado em
 *   ies_features que já existia.
 *
 * É usada como destino padrão em todos os redirecionamentos do roteador
 * (login, raiz e bloqueio de acesso cruzado), garantindo que cada usuário
 * "caia na sua experiência" e que tentativas de acesso fora dela voltem
 * para o entrypoint correto.
 */
export const getDefaultRouteForUser = (
  user: User | null,
  accessRules: AccessRules,
  access?: Access,
): string => {
  const experiences = access?.experiences ?? ['aluno'];
  const dedicated = ENTRYPOINT_PRECEDENCE.find((exp) => experiences.includes(exp));
  if (dedicated) return EXPERIENCE_ENTRYPOINTS[dedicated];

  if (accessRules.home) return '/';
  if (accessRules.simulados) return '/simulados';
  if (accessRules.studyGuide) return '/guia-estudos';
  if (accessRules.dashboard) return '/dashboard';
  if (accessRules.sanarclass) return '/sanarclass';
  return '/home';
};
