import type { NavItem } from '@/experiences/types';
import { can, type Access } from '@/experiences/access';
import type { DesempenhoV2Tab } from '@/types/desempenhoV2';

/**
 * Item da sub-navegação da experiência Gestão, ligando a URL `/gestor/*` ao
 * módulo correspondente do Desempenho Institucional (v2).
 */
export interface GestorNavItem extends NavItem {
  /** Módulo do Desempenho Institucional renderizado nesta rota. */
  tab: DesempenhoV2Tab;
}

/**
 * Sub-navegação canônica da experiência Gestão (`/gestor/*`).
 *
 * Cada módulo do Desempenho Institucional v2 — hoje uma aba por estado
 * (`PerformanceModuleTabs`) — passa a ter URL própria. A `tab` mantém o vínculo
 * com {@link DesempenhoV2Tab} para o conteúdo (ModuleContentRenderer) e os
 * drawers (Export/IA) saberem o módulo ativo a partir da rota.
 */
export const GESTOR_NAV: GestorNavItem[] = [
  { title: 'Visão Institucional', url: '/gestor/visao-institucional', tab: 'visao-institucional', capability: 'institutional.view' },
  { title: 'Diagnóstico Curricular', url: '/gestor/diagnostico-curricular', tab: 'diagnostico-curricular', capability: 'institutional.view' },
  { title: 'Visão de Alunos', url: '/gestor/alunos', tab: 'visao-alunos', capability: 'alunos.view' },
  { title: 'Insights Pedagógicos', url: '/gestor/insights-pedagogicos', tab: 'insights-pedagogicos', capability: 'institutional.view' },
  { title: 'Inteligência Decisória', url: '/gestor/inteligencia-decisoria', tab: 'inteligencia-decisoria', capability: 'institutional.view' },
];

/** Sub-navegação filtrada pelas capabilities do `access` do usuário. */
export const filterGestorNav = (items: GestorNavItem[], access: Access): GestorNavItem[] =>
  items.filter((item) => item.capability == null || can(access, item.capability));

/** Módulo (tab) correspondente a um pathname `/gestor/*` (fallback: visão institucional). */
export const tabForPath = (pathname: string): DesempenhoV2Tab =>
  GESTOR_NAV.find((item) => pathname.startsWith(item.url))?.tab ??
  'visao-institucional';
