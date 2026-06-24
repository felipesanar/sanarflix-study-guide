import {
  Users,
  Bell,
  Building2,
  Upload,
  FileText,
  ClipboardList,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import type { NavItem } from '@/experiences/types';

export const adminNav: NavItem[] = [
  { title: 'Usuários', url: '/admin/usuarios', icon: Users },
  { title: 'Avisos', url: '/admin/avisos', icon: Bell },
  { title: 'IES', url: '/admin/ies', icon: Building2 },
  { title: 'Guia', url: '/admin/guia', icon: Upload },
  { title: 'SanarClass', url: '/admin/sanarclass', icon: FileText },
  { title: 'Simulados', url: '/admin/simulados', icon: ClipboardList },
  { title: 'Feedbacks', url: '/admin/feedbacks', icon: MessageSquare },
  { title: 'Analytics', url: '/admin/analytics', icon: TrendingUp },
];
