import type { ElementType } from 'react';
import type { AccessRules } from '@/types';
import type { Experience } from '@/utils/experiences';

/**
 * Identificador de cada experiência apartada do SanarFlix Academy.
 *
 * É o mesmo conjunto resolvido por {@link Experience} em
 * `src/utils/experiences.ts` — aqui apenas reexportado com o nome canônico
 * usado pelo módulo de experiências (`src/experiences/`), mantendo uma única
 * fonte da verdade para as roles/experiências:
 *
 *  - `aluno_professor` — Aluno + Professor
 *  - `gestao`          — Gestor IES + Gestor de Grupo
 *  - `admin`           — Admin
 *  - `atendimento`     — Atendimento (CX)
 */
export type ExperienceId = Experience;

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
  /** Ícone do item (componente React ou tag intrínseca). */
  icon: ElementType;
  /**
   * Chave de {@link AccessRules} que controla a visibilidade do item.
   *
   * Quando omitida, o item é sempre visível (não depende de regra de acesso).
   */
  accessKey?: keyof AccessRules;
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
