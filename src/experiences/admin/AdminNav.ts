import {
  Users,
  Bell,
  Building2,
  Upload,
  FileText,
  ClipboardList,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import type { NavItem } from '@/experiences/types';

/**
 * Item da sub-navegação do Portal do Admin.
 *
 * Estende {@link NavItem} com a visibilidade para Atendimento (CX): por padrão
 * cada seção é exclusiva do admin; apenas as marcadas com `cxVisible` aparecem
 * também para o Atendimento.
 */
export interface AdminNavItem extends NavItem {
  /** Visível também para Atendimento (CX). Default: false (só admin). */
  cxVisible?: boolean;
}

/**
 * Sub-navegação canônica do Portal do Admin (`/admin/*`).
 *
 * Cada seção — hoje uma aba por estado em `UserManagement` — passa a ter URL
 * própria. O Atendimento (CX) enxerga apenas "Usuários" (ver {@link filterAdminNav}).
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { title: 'Usuários', url: '/admin/usuarios', icon: Users, cxVisible: true },
  { title: 'Avisos', url: '/admin/avisos', icon: Bell },
  { title: 'IES', url: '/admin/ies', icon: Building2 },
  { title: 'Guia', url: '/admin/guia', icon: Upload },
  { title: 'SanarClass', url: '/admin/sanarclass', icon: FileText },
  { title: 'Simulados', url: '/admin/simulados', icon: ClipboardList },
  { title: 'Feedbacks', url: '/admin/feedbacks', icon: MessageSquare },
  { title: 'Analytics', url: '/admin/analytics', icon: BarChart3 },
];

/**
 * Filtra a sub-navegação do admin pelo papel do usuário.
 *
 * - Admin: vê todas as seções.
 * - Atendimento (CX): vê apenas as seções marcadas com `cxVisible` (Usuários).
 */
export const filterAdminNav = (
  items: AdminNavItem[],
  opts: { isAdmin: boolean },
): AdminNavItem[] =>
  opts.isAdmin ? items : items.filter((item) => item.cxVisible);
