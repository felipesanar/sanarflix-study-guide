import {
  Home,
  BookOpen,
  BarChart3,
  ClipboardCheck,
  GraduationCap,
  BookMarked,
} from 'lucide-react';
import type { NavItem } from '@/experiences/types';

/**
 * Navegação canônica da experiência Aluno + Professor.
 *
 * Fonte única dos itens de navegação do aluno (rótulo, rota, ícone e a
 * `accessKey` que controla a visibilidade via {@link filterNavByAccess}). A
 * Home vive na raiz (`/`) — ver F1·4/F1·6. Os componentes de navegação
 * (AppSidebar, MobileBottomNav) usam estas mesmas URLs; conforme a navegação
 * for sendo apartada por experiência, eles passam a consumir esta lista
 * diretamente.
 */
export const ALUNO_NAV: NavItem[] = [
  {
    title: 'Início',
    url: '/',
    icon: Home,
    accessKey: 'home',
    description: 'Sua página inicial personalizada',
  },
  {
    title: 'Seu guia',
    url: '/guia-estudos',
    icon: BookOpen,
    accessKey: 'studyGuide',
    description: 'Materiais organizados por disciplina',
  },
  {
    title: 'Seu progresso',
    url: '/dashboard',
    icon: BarChart3,
    accessKey: 'dashboard',
    description: 'Visualize sua evolução',
  },
  {
    title: 'Simulados',
    url: '/simulados',
    icon: ClipboardCheck,
    accessKey: 'simulados',
    description: 'Simulados completos e desempenho',
  },
  {
    title: 'SanarClass',
    url: '/sanarclass',
    icon: GraduationCap,
    accessKey: 'sanarclass',
    description: 'Aulas da sua IES com o SanarFlix Academy',
  },
  {
    title: 'Caderno de Erros',
    url: '/caderno-de-erros',
    icon: BookMarked,
    accessKey: 'errorNotebook',
    description: 'Revise seus gaps e evite repeti-los',
  },
];
