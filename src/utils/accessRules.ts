import { AccessRules, User } from '@/types';

export const getAccessRules = (user: User | null): AccessRules => {
  // Lançamento inicial: apenas Intensivão ENAMED habilitado
  // Desabilita Guia de Estudos e Dashboard para todos os usuários
  
  // PRIMEIRO, VERIFIQUE SE O USUÁRIO EXISTE
  if (!user) {
    // Retorna as regras padrão para um usuário deslogado ou em carregamento
    return {
      studyGuide: false,
      enamed: true,
      dashboard: false,
      SimuladoDesempenho: false,
      userManagement: false,
    };
  }
  
  // Agora que sabemos que o usuário não é nulo, podemos acessar suas propriedades
  const { id_ies } = user;

  switch (id_ies) {
    case '9f21b138-0027-44c8-9660-dc6706d57bc0':
      return {
        studyGuide: true,
        enamed: true,
        dashboard: true,
        SimuladoDesempenho: true,
        userManagement: true
      };

      case '954aad2f-4030-4d5d-b27a-19eb8fac05cf':
      return {
        studyGuide: true,
        enamed: true,
        dashboard: true,
        SimuladoDesempenho: false,
        userManagement: false
      };

      case '12cfa7f2-45ba-406f-9e4d-aa719a6b94ca':
      return {
        studyGuide: true,
        enamed: true,
        dashboard: true,
        SimuladoDesempenho: false,
        userManagement: false
      };
    
    default:
      return {
        studyGuide: false,
        enamed: true,
        dashboard: false,
        SimuladoDesempenho: false,
        userManagement: false
      };
  }
};