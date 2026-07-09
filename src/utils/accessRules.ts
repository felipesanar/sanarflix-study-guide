import { User } from '@/types';

/**
 * Verifica se usuário é administrador
 */
export const isAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return user.roles?.includes('admin') || false;
};

/**
 * Verifica se usuário é professor
 */
export const isProfessor = (user: User | null): boolean => {
  if (!user) return false;
  return user.roles?.includes('professor') || false;
};

/**
 * Verifica se usuário é gestor (inclui variantes 'gestor' e 'gestor_grupo')
 */
export const isGestor = (user: User | null): boolean => {
  if (!user) return false;
  return (
    user.roles?.includes('gestor') ||
    user.roles?.includes('gestor_grupo') ||
    false
  );
};

/**
 * Verifica se usuário é gestor de grupo educacional (multi-IES).
 */
export const isGestorGrupo = (user: User | null): boolean => {
  if (!user) return false;
  return user.roles?.includes('gestor_grupo') || false;
};

/**
 * Verifica se usuário é atendimento
 */
export const isAtendimento = (user: User | null): boolean => {
  if (!user) return false;
  return user.roles?.includes('atendimento') || false;
};
