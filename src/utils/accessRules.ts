import { AccessRules, User } from '@/types';

// Helper function to check if user is B2B (excluding B2C and USCS)
export const isB2BUser = (user: User | null): boolean => {
  if (!user) return false;
  const B2B_IES_ID = '9f21b138-0027-44c8-9660-dc6706d57bc0';
  return user.id_ies == B2B_IES_ID;
};

export const getAccessRules = (user: User | null): AccessRules => {
  // PRIMEIRO, VERIFIQUE SE O USUÁRIO EXISTE
  if (!user) {
    // Retorna as regras padrão para um usuário deslogado ou em carregamento
    return {
      studyGuide: false,
      enamed: false,
      cronogramaEnamed: false,
      dashboard: false,
      SimuladoDesempenho: false,
      userManagement: false,
      intensivoUSCS: false,
    };
  }
  
  // Agora que sabemos que o usuário não é nulo, podemos acessar suas propriedades
  const { id_ies } = user;

  // B2C IES ID (usuários cadastrados via página B2C)
  const B2C_IES_ID = 'abec7c7d-ef07-4871-9e19-090f4d951e5e';

  // Verificar se é usuário B2C
  if (id_ies === B2C_IES_ID) {
    return {
      studyGuide: false,
      enamed: false, // B2C não tem acesso ao intensivão completo
      cronogramaEnamed: true, // B2C só tem acesso ao cronograma dos últimos 30 dias
      dashboard: false,
      SimuladoDesempenho: false,
      userManagement: false,
      intensivoUSCS: false
    };
  }

  // Regras para IES específicas (usuários B2B)
  switch (id_ies) {
    case '9f21b138-0027-44c8-9660-dc6706d57bc0':
      return {
        studyGuide: true,
        enamed: true,
        cronogramaEnamed: false, // B2B não precisa do cronograma limitado
        dashboard: true,
        SimuladoDesempenho: true,
        userManagement: true,
        intensivoUSCS: false
      };

      case '954aad2f-4030-4d5d-b27a-19eb8fac05cf':
      return {
        studyGuide: true,
        enamed: true,
        cronogramaEnamed: false,
        dashboard: true,
        SimuladoDesempenho: false,
        userManagement: false,
        intensivoUSCS: false // USCS tem acesso à página exclusiva
      };

      case '12cfa7f2-45ba-406f-9e4d-aa719a6b94ca':
      return {
        studyGuide: false,
        enamed: true,
        cronogramaEnamed: false,
        dashboard: false,
        SimuladoDesempenho: true,
        userManagement: false,
        intensivoUSCS: false
      };

      case '3e51663e-8766-4881-bfd1-0921678ed014':
      return {
        studyGuide: false,
        enamed: true,
        cronogramaEnamed: false,
        dashboard: false,
        SimuladoDesempenho: true,
        userManagement: false,
        intensivoUSCS: false
      };

      case '5c6e697f-853c-415b-8690-65a27a9384f0':
      return {
        studyGuide: false,
        enamed: true,
        cronogramaEnamed: false,
        dashboard: false,
        SimuladoDesempenho: true,
        userManagement: false,
        intensivoUSCS: false
      };

      case '314b3bb2-a758-42d6-a9bb-e68e2fb35bba':
      return {
        studyGuide: false,
        enamed: true,
        cronogramaEnamed: false,
        dashboard: false,
        SimuladoDesempenho: true,
        userManagement: false,
        intensivoUSCS: false
      };

      case 'e40a0ec1-1150-40e6-b492-8b8e3f8db593':
      return {
        studyGuide: false,
        enamed: false,
        cronogramaEnamed: false,
        dashboard: false,
        SimuladoDesempenho: true,
        userManagement: false,
        intensivoUSCS: true // USCS tem acesso à página exclusiva
      };
    
    default:
      // Outras IES - acesso padrão ao intensivão completo
      return {
        studyGuide: false,
        enamed: true,
        cronogramaEnamed: false,
        dashboard: false,
        SimuladoDesempenho: false,
        userManagement: false,
        intensivoUSCS: false
      };
  }
};