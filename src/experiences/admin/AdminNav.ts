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
import { can, type Access } from '@/experiences/access';

/** Item da sub-navegação do Portal do Admin — cada seção declara a sua capability. */
export type AdminNavItem = NavItem;

/**
 * Sub-navegação canônica do Portal do Admin (`/admin/*`).
 *
 * Cada seção — hoje uma aba por estado em `UserManagement` — passa a ter URL
 * própria e uma `capability` que controla a sua visibilidade (ver
 * {@link filterAdminNav}). Atendimento (CX) só tem `users.support`, então só
 * enxerga "Usuários".
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { title: 'Usuários', url: '/admin/usuarios', icon: Users, capability: 'users.manage' },
  { title: 'Avisos', url: '/admin/avisos', icon: Bell, capability: 'avisos.manage' },
  { title: 'IES', url: '/admin/ies', icon: Building2, capability: 'ies.manage' },
  { title: 'Guia', url: '/admin/guia', icon: Upload, capability: 'guia.manage' },
  { title: 'SanarClass', url: '/admin/sanarclass', icon: FileText, capability: 'sanarclass.manage' },
  { title: 'Simulados', url: '/admin/simulados', icon: ClipboardList, capability: 'simulados.manage' },
  { title: 'Feedbacks', url: '/admin/feedbacks', icon: MessageSquare, capability: 'feedbacks.moderate' },
  { title: 'Analytics', url: '/admin/analytics', icon: BarChart3, capability: 'analytics.view' },
];

/**
 * Filtra a sub-navegação do admin pela capability do `access` do usuário.
 *
 * Usuários de Atendimento (CX) acessam esta mesma árvore de rotas quando
 * `users.support` está presente (ver AtendimentoLayout), mas aqui a checagem
 * é sempre por capability — nunca role literal.
 */
export const filterAdminNav = (items: AdminNavItem[], access: Access): AdminNavItem[] =>
  items.filter((item) => item.capability == null || can(access, item.capability));
