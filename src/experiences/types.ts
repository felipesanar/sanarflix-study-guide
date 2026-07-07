import type { ElementType } from 'react';
import type { AccessRules } from '@/types';
import type { ExperienceId, Capability } from '@/experiences/access';

/**
 * Identificador de cada experiência apartada do SanarFlix Academy.
 *
 * Reexportado de {@link ExperienceId} em `src/experiences/access.ts` —
 * fonte única de verdade para as experiências (aditivas, uma por
 * `access.experiences`):
 *
 *  - `aluno`       — Aluno + Professor (base, todo usuário autenticado tem)
 *  - `gestao`      — Gestor IES + Gestor de Grupo
 *  - `admin`       — Admin
 *  - `atendimento` — Atendimento (CX)
 */
export type { ExperienceId };

/**
 * Item de navegação de uma experiência.
 *
 * Reflete o formato já usado pelos componentes de navegação
 * (AppSidebar, MobileBottomNav): um destino de rota com rótulo, ícone e,
 * opcionalmente, a chave de {@link AccessRules} que controla a sua
 * visibilidade.
 */
export interface NavItem {
  /** Rótulo exibido no item. */
  title: string;
  /** Rota de destino. */
  url: string;
  /** Ícone do item (componente React ou tag intrínseca). Opcional: navegações
   *  text-only (ex.: módulos do gestor) podem omiti-lo. */
  icon?: ElementType;
  /**
   * Chave de {@link AccessRules} que controla a visibilidade do item.
   *
   * Quando omitida, o item é sempre visível (não depende de regra de acesso).
   */
  accessKey?: keyof AccessRules;
  /**
   * Capability que controla a visibilidade do item nos portais dedicados
   * (admin/gestão/atendimento). Telas e navegação checam `can(access, cap)` —
   * nunca role literal. Quando omitida, o item é sempre visível dentro do
   * portal (não depende de capability).
   */
  capability?: Capability;
  /** Descrição opcional (tooltip / acessibilidade). */
  description?: string;
  /** Contador opcional exibido como badge (ex.: pendências do caderno de erros). */
  badge?: number;
}

/**
 * Filtra uma lista de {@link NavItem} pelas regras de acesso do usuário.
 *
 * Mantém o item quando:
 *  - ele não declara `accessKey` (sempre visível); ou
 *  - a `accessKey` declarada está habilitada em `accessRules`.
 *
 * É pura: preserva a ordem e não muta a lista de entrada.
 */
export const filterNavByAccess = (
  items: NavItem[],
  accessRules: AccessRules,
): NavItem[] =>
  items.filter((item) => item.accessKey == null || accessRules[item.accessKey]);
