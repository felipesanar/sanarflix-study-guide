import { AccessRules, User } from '@/types';

/**
 * Sistema de Regras de Acesso Simplificado
 * 
 * Tipos de usuários:
 * 1. Admin: Role 'admin' em user_roles - acesso total (super usuário)
 * 2. Professor: Role 'professor' em user_roles - a definir futuramente
 * 3. Aluno B2B: Vinculado a IES configurada - features via ies_features
 * 
 * Nota: Features específicas por IES são carregadas dinamicamente
 * via hook useIesFeatures que consulta a tabela ies_features
 */

/**
 * Regras de acesso padrão (base para todos os usuários autenticados)
 * Usuários não autenticados não devem ter acesso a nada
 */
const DEFAULT_RULES: AccessRules = {
  home: false,
  studyGuide: false,
  dashboard: false,
  SimuladoDesempenho: false,
  userManagement: false,
  sanarclass: false,
  simulados: true,
  analytics: false,
  desempenhoInstitucional: false,
};

/**
 * Regras de acesso total para administradores
 */
const ADMIN_RULES: AccessRules = {
  home: true,
  studyGuide: true,
  dashboard: true,
  SimuladoDesempenho: true,
  userManagement: true,
  sanarclass: true,
  simulados: true,
  analytics: true,
};

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
 * @deprecated Use isAdmin() instead
 * Mantido para compatibilidade temporária
 */
export const isB2BUser = (user: User | null): boolean => {
  return isAdmin(user);
};

/**
 * Obtém regras de acesso baseadas no usuário
 * 
 * Hierarquia de permissões:
 * 1. Usuário não autenticado → sem acesso
 * 2. Admin → acesso total (super usuário)
 * 3. Professor → regras de professor (a definir)
 * 4. Aluno B2B → features da sua IES (via useIesFeatures hook)
 * 
 * Nota: Para alunos B2B, as features específicas da IES são
 * aplicadas pelo componente que consome este hook, combinando
 * estas regras base com as features do useIesFeatures.
 */
export const getAccessRules = (user: User | null): AccessRules => {
  // Usuário não autenticado - sem acesso
  if (!user) {
    return {
      home: false,
      studyGuide: false,
      dashboard: false,
      SimuladoDesempenho: false,
      userManagement: false,
      sanarclass: false,
      simulados: false,
      analytics: false,
    };
  }
  
  // Admin: acesso total como super usuário
  if (isAdmin(user)) {
    return { ...ADMIN_RULES };
  }

  // Professor: regras específicas (a definir futuramente)
  if (isProfessor(user)) {
    return {
      ...DEFAULT_RULES,
      home: true,
      studyGuide: true,
      dashboard: true,
      sanarclass: true,
    };
  }

  // Aluno B2B: regras padrão
  // Features específicas da IES são aplicadas via useIesFeatures hook
  // e combinadas no componente que consome este hook
  return { ...DEFAULT_RULES };
};
