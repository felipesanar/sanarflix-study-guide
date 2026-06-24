import type { LucideIcon } from 'lucide-react';
import type { AccessRules } from '@/types';

/**
 * Identificador curto de cada experiência apartada (uso em nav/rotas).
 * Difere de {@link Experience} em utils/experiences.ts, que usa
 * 'aluno_professor' | 'gestao' para a resolução por role.
 */
export type ExperienceId = 'aluno' | 'admin' | 'gestor' | 'atendimento';

/** Item de navegação de uma experiência (sidebar, sub-nav, bottom-nav). */
export interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  accessKey?: keyof AccessRules;
  description?: string;
}

/** Mantém só os itens cujo accessKey está liberado (itens sem accessKey ficam). */
export const filterNavByAccess = (
  items: NavItem[],
  accessRules: AccessRules,
): NavItem[] =>
  items.filter((item) => !item.accessKey || !!accessRules[item.accessKey]);
