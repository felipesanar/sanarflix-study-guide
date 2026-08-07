import {
  Home,
  ClipboardList,
  Activity,
  Users,
  Building2,
  BookOpen,
  Bell,
  FileText,
  MessageSquare,
  BarChart3,
  History,
  FileSignature,
} from 'lucide-react';
import type { NavItem } from '@/experiences/types';
import { can, type Access } from '@/experiences/access';
import type { AdminAttentionCounts } from '@/services/admin/useAdminAttention';

/**
 * Item da navegação do console (Admin/CX) — cada seção declara a `capability`
 * que controla a sua visibilidade (ver {@link filterAdminNav}). Item sem
 * `capability` é sempre visível dentro do portal (caso do Command Center,
 * home só do admin).
 *
 * `badgeKey`, quando presente, indexa a contagem de atenção devolvida por
 * `useAdminAttention` (ver `src/services/admin/useAdminAttention.ts`) — o
 * shell exibe o número como badge; sem contagem carregada (loading/erro), o
 * item aparece sem badge, nunca com um número inventado.
 */
export interface AdminNavItem extends NavItem {
  badgeKey?: keyof AdminAttentionCounts;
}

/** Grupo de itens da navegação — o rótulo aparece mono/uppercase no shell. */
export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/**
 * Navegação canônica do Portal do Admin (`/admin/*`): 4 grupos, 12 itens.
 *
 * - Operação: Command Center, Simulados, Monitoramento.
 * - Contas & acesso: Usuários, IES, Contratos & cronograma.
 * - Conteúdo & comunicação: Guia de Estudos, Avisos, SanarClass.
 * - Suporte & dados: Feedbacks, Analytics, Auditoria.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Operação',
    items: [
      { title: 'Command Center', url: '/admin', icon: Home },
      {
        title: 'Simulados',
        url: '/admin/simulados',
        icon: ClipboardList,
        capability: 'simulados.manage',
        badgeKey: 'simuladosEncerrandoHoje',
      },
      { title: 'Monitoramento', url: '/admin/monitoramento', icon: Activity, capability: 'simulados.manage' },
    ],
  },
  {
    label: 'Contas & acesso',
    items: [
      { title: 'Usuários', url: '/admin/usuarios', icon: Users, capability: 'users.manage' },
      {
        title: 'IES',
        url: '/admin/ies',
        icon: Building2,
        capability: 'ies.manage',
        badgeKey: 'iesSemSimuladoAtivo',
      },
      {
        title: 'Contratos & cronograma',
        url: '/admin/contratos',
        icon: FileSignature,
        capability: 'ies.manage',
      },
    ],
  },
  {
    label: 'Conteúdo & comunicação',
    items: [
      { title: 'Guia de Estudos', url: '/admin/guia', icon: BookOpen, capability: 'guia.manage' },
      { title: 'Avisos', url: '/admin/avisos', icon: Bell, capability: 'avisos.manage' },
      { title: 'SanarClass', url: '/admin/sanarclass', icon: FileText, capability: 'sanarclass.manage' },
    ],
  },
  {
    label: 'Suporte & dados',
    items: [
      {
        title: 'Feedbacks',
        url: '/admin/feedbacks',
        icon: MessageSquare,
        capability: 'feedbacks.moderate',
        badgeKey: 'feedbacksPendentes',
      },
      { title: 'Analytics', url: '/admin/analytics', icon: BarChart3, capability: 'analytics.view' },
      { title: 'Auditoria', url: '/admin/auditoria', icon: History, capability: 'admin.tools' },
    ],
  },
];

/**
 * Navegação do Atendimento (CX, `/atendimento/*`): 1 grupo ("Atendimento"),
 * 2 itens — Usuários e Feedbacks — reusando as MESMAS páginas do admin com
 * capability de suporte (`users.support`/`feedbacks.support`).
 */
export const CX_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Atendimento',
    items: [
      { title: 'Usuários', url: '/atendimento/usuarios', icon: Users, capability: 'users.support' },
      { title: 'Feedbacks', url: '/atendimento/feedbacks', icon: MessageSquare, capability: 'feedbacks.support' },
    ],
  },
];

/**
 * Filtra os grupos de navegação pela capability do `access` do usuário.
 *
 * Remove, em cada grupo, os itens cuja `capability` o usuário não tem;
 * grupos que ficam sem nenhum item visível são removidos da lista. Item sem
 * `capability` (Command Center) é sempre mantido. Página NUNCA checa role
 * literal — a fonte da verdade é `can()`.
 */
export const filterAdminNav = (groups: AdminNavGroup[], access: Access): AdminNavGroup[] =>
  groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.capability == null || can(access, item.capability)),
    }))
    .filter((group) => group.items.length > 0);
