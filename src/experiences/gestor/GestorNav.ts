import {
  LayoutDashboard,
  BookOpenCheck,
  Users,
  Target,
  ClipboardList,
  GitCompareArrows,
  Download,
  type LucideIcon,
} from 'lucide-react';
import { can, type Access } from '@/experiences/access';
import type { Capability } from '@/experiences/access';

/**
 * Item de navegação da sidebar do console de Gestão (`/gestor/*`).
 *
 * Independente de {@link NavItem} (aluno/admin) porque o badge aqui é um
 * rótulo textual (ex.: "novo"), não um contador numérico.
 */
export interface GestorNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Capability que controla a visibilidade do item. Sempre visível quando omitida. */
  capability?: Capability;
  /** Quando `true`, só aparece para usuários com mais de 1 IES acessível (gestor de grupo). */
  groupOnly?: boolean;
  /** Rótulo curto de destaque (ex.: "novo"). */
  badge?: string;
}

/**
 * Navegação canônica do console de Gestão — 7 itens fixos da sidebar.
 *
 * Ver contrato: `.superpowers/gestor-design/PLANO-IMPLEMENTACAO.md`.
 */
export const GESTOR_NAV: GestorNavItem[] = [
  { path: '/gestor/panorama', label: 'Panorama', icon: LayoutDashboard, capability: 'institutional.view' },
  { path: '/gestor/diagnostico-curricular', label: 'Diagnóstico curricular', icon: BookOpenCheck, capability: 'institutional.view' },
  { path: '/gestor/alunos-risco', label: 'Alunos & risco', icon: Users, capability: 'alunos.view' },
  { path: '/gestor/intervencao-impacto', label: 'Intervenção & impacto', icon: Target, capability: 'institutional.view' },
  { path: '/gestor/simulados-questoes', label: 'Simulados & questões', icon: ClipboardList, capability: 'institutional.view', badge: 'novo' },
  { path: '/gestor/comparar-ies', label: 'Comparar IES', icon: GitCompareArrows, capability: 'institutional.view', groupOnly: true },
  { path: '/gestor/relatorios', label: 'Relatórios', icon: Download, capability: 'institutional.view' },
];

/**
 * Navegação filtrada pelas capabilities do `access` do usuário e pelo escopo
 * multi-IES (`groupOnly`). Nunca checa role literal — só `can(access, cap)`.
 */
export const filterGestorNav = (
  items: GestorNavItem[],
  access: Access,
  accessibleIesCount: number,
): GestorNavItem[] =>
  items.filter((item) => {
    if (item.capability != null && !can(access, item.capability)) return false;
    if (item.groupOnly && accessibleIesCount <= 1) return false;
    return true;
  });
