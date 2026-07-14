/**
 * Modelo de acesso por experiências + capabilities.
 *
 * Duas dimensões ortogonais:
 * - Experiência: qual portal/árvore de rota o usuário acessa (aditivo — pode ter várias).
 * - Capability: o que as telas mostram. Telas checam capability, nunca role literal.
 *
 * A fonte da verdade é a RPC `get_access` no banco (SECURITY DEFINER); este módulo
 * espelha o mapeamento como fallback e para impersonação. Segurança real é RLS/RPC —
 * tudo aqui é UX.
 */

export type ExperienceId = 'aluno' | 'gestao' | 'admin' | 'atendimento';

export type Capability =
  | 'users.manage'
  | 'users.edit'
  | 'avisos.manage'
  | 'ies.manage'
  | 'guia.manage'
  | 'sanarclass.manage'
  | 'simulados.manage'
  | 'feedbacks.moderate'
  | 'analytics.view'
  | 'impersonate'
  | 'admin.tools'
  | 'institutional.view'
  | 'alunos.view'
  | 'users.support'
  | 'feedbacks.support';

export interface Access {
  roles: string[];
  experiences: ExperienceId[];
  capabilities: Capability[];
}

export const EMPTY_ACCESS: Access = {
  roles: [],
  experiences: ['aluno'],
  capabilities: [],
};

const ADMIN_CAPABILITIES: Capability[] = [
  'users.manage',
  'users.edit',
  'avisos.manage',
  'ies.manage',
  'guia.manage',
  'sanarclass.manage',
  'simulados.manage',
  'feedbacks.moderate',
  'analytics.view',
  'impersonate',
  'admin.tools',
  'institutional.view',
  'alunos.view',
];

const GESTOR_CAPABILITIES: Capability[] = ['institutional.view', 'alunos.view'];

const ATENDIMENTO_CAPABILITIES: Capability[] = ['users.support', 'users.edit', 'feedbacks.support'];

/** Espelho client-side do mapeamento da RPC get_access (fallback e impersonação). */
export const deriveAccessFromRoles = (roles: string[] | undefined | null): Access => {
  const safeRoles = roles ?? [];
  const experiences = new Set<ExperienceId>(['aluno']);
  const capabilities = new Set<Capability>();

  if (safeRoles.includes('admin')) {
    experiences.add('admin');
    experiences.add('gestao');
    ADMIN_CAPABILITIES.forEach((cap) => capabilities.add(cap));
  }
  if (safeRoles.includes('gestor') || safeRoles.includes('gestor_grupo')) {
    experiences.add('gestao');
    GESTOR_CAPABILITIES.forEach((cap) => capabilities.add(cap));
  }
  if (safeRoles.includes('atendimento')) {
    experiences.add('atendimento');
    ATENDIMENTO_CAPABILITIES.forEach((cap) => capabilities.add(cap));
  }

  return {
    roles: safeRoles,
    experiences: Array.from(experiences),
    capabilities: Array.from(capabilities),
  };
};

const VALID_EXPERIENCES: ExperienceId[] = ['aluno', 'gestao', 'admin', 'atendimento'];

/** Valida/normaliza o payload da RPC get_access; devolve null se o formato for inválido. */
export const parseAccessPayload = (payload: unknown): Access | null => {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  if (!Array.isArray(raw.roles) || !Array.isArray(raw.experiences) || !Array.isArray(raw.capabilities)) {
    return null;
  }
  const experiences = raw.experiences.filter(
    (exp): exp is ExperienceId => typeof exp === 'string' && (VALID_EXPERIENCES as string[]).includes(exp)
  );
  return {
    roles: raw.roles.filter((r): r is string => typeof r === 'string'),
    experiences: experiences.length > 0 ? experiences : ['aluno'],
    capabilities: raw.capabilities.filter((c): c is Capability => typeof c === 'string') as Capability[],
  };
};

export const can = (access: Access | null | undefined, cap: Capability): boolean =>
  access?.capabilities.includes(cap) ?? false;

export const hasExperience = (access: Access | null | undefined, exp: ExperienceId): boolean =>
  exp === 'aluno' ? true : access?.experiences.includes(exp) ?? false;
