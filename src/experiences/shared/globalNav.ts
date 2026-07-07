import { UserCog, School, Headset } from 'lucide-react';
import { hasExperience, type Access } from '@/experiences/access';
import type { NavItem } from '@/experiences/types';

/**
 * Entradas de navegação para os PORTAIS dedicados do usuário.
 *
 * Todo usuário tem a experiência de aluno na base; quem tem experiência
 * dedicada em `access.experiences` ganha, por cima, o(s) link(s) para o seu
 * portal. Cada entrada aponta para o entrypoint CORRETO da experiência — em
 * especial, o CX vai para `/atendimento/usuarios` (não `/admin/*`, que ele não
 * acessa). Um usuário com múltiplas experiências recebe uma entrada por
 * portal, na ordem admin > gestão > CX.
 */
export const getPortalEntries = (access: Access | null | undefined): NavItem[] => {
  const entries: NavItem[] = [];
  if (hasExperience(access, 'admin')) {
    entries.push({ title: 'Portal do Admin', url: '/admin/usuarios', icon: UserCog });
  }
  if (hasExperience(access, 'gestao')) {
    entries.push({ title: 'Desempenho Institucional', url: '/gestor', icon: School });
  }
  if (hasExperience(access, 'atendimento')) {
    entries.push({ title: 'Atendimento', url: '/atendimento/usuarios', icon: Headset });
  }
  return entries;
};
