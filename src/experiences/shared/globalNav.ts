import { UserCog, School, Headset } from 'lucide-react';
import type { User } from '@/types';
import { isAdmin, isGestor, isAtendimento } from '@/utils/accessRules';
import type { NavItem } from '@/experiences/types';

/**
 * Entradas de navegação para os PORTAIS dedicados do usuário.
 *
 * No modelo híbrido, todo usuário tem a experiência de aluno na base; quem tem
 * role privilegiada ganha, por cima, o(s) link(s) para o seu portal dedicado.
 * Cada entrada aponta para o entrypoint CORRETO da role — em especial, o CX vai
 * para `/atendimento/usuarios` (não `/admin/*`, que ele não acessa). Um usuário
 * com múltiplas roles recebe uma entrada por portal, na ordem admin > gestão > CX.
 */
export const getPortalEntries = (user: User | null): NavItem[] => {
  const entries: NavItem[] = [];
  if (isAdmin(user)) {
    entries.push({ title: 'Portal do Admin', url: '/admin/usuarios', icon: UserCog });
  }
  if (isGestor(user) || isAdmin(user)) {
    entries.push({ title: 'Desempenho Institucional', url: '/gestor', icon: School });
  }
  if (isAtendimento(user)) {
    entries.push({ title: 'Atendimento', url: '/atendimento/usuarios', icon: Headset });
  }
  return entries;
};
