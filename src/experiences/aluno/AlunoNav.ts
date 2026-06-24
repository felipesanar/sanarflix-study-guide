import {
  BookOpen,
  BarChart3,
  ClipboardCheck,
  Home as HomeIcon,
  GraduationCap,
  BookMarked,
} from 'lucide-react';
import type { NavItem } from '@/experiences/types';

export const alunoNav: NavItem[] = [
  { title: 'Início', url: '/', icon: HomeIcon, accessKey: 'home', description: 'Sua página inicial' },
  { title: 'SanarClass', url: '/sanarclass', icon: GraduationCap, accessKey: 'sanarclass' },
  { title: 'Simulados', url: '/simulados', icon: ClipboardCheck, accessKey: 'simulados' },
  { title: 'Caderno de Erros', url: '/caderno-de-erros', icon: BookMarked, accessKey: 'errorNotebook' },
  { title: 'Seu guia', url: '/guia-estudos', icon: BookOpen, accessKey: 'studyGuide' },
  { title: 'Seu progresso', url: '/dashboard', icon: BarChart3, accessKey: 'dashboard' },
];
