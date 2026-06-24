import { LayoutDashboard, GraduationCap, Users, Lightbulb, Brain } from 'lucide-react';
import type { NavItem } from '@/experiences/types';

export const gestorNav: NavItem[] = [
  { title: 'Visão Institucional', url: '/gestor/visao-institucional', icon: LayoutDashboard },
  { title: 'Diagnóstico Curricular', url: '/gestor/diagnostico-curricular', icon: GraduationCap },
  { title: 'Alunos', url: '/gestor/alunos', icon: Users },
  { title: 'Insights Pedagógicos', url: '/gestor/insights-pedagogicos', icon: Lightbulb },
  { title: 'Inteligência Decisória', url: '/gestor/inteligencia-decisoria', icon: Brain },
];
