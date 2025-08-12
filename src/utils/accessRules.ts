import { AccessRules, User } from '@/types';

export const getAccessRules = (user: User | null): AccessRules => {
  // Lançamento inicial: apenas Intensivão ENAMED habilitado
  // Desabilita Guia de Estudos e Dashboard para todos os usuários
  if (!user) {
    return {
      studyGuide: false,
      enamed: true,
      dashboard: false,
    };
  }

  return {
    studyGuide: false,
    enamed: true,
    dashboard: false,
  };
};
