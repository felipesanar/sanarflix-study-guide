import { AccessRules, User } from '@/types';

export const getAccessRules = (user: User | null): AccessRules => {
  if (!user) {
    return {
      studyGuide: false,
      enamed: false,
      dashboard: false
    };
  }

  const { ies_nome, semestre } = user;

  switch (ies_nome) {
    case 'Funepe':
    case 'Famp':
      return {
        studyGuide: true,
        enamed: true,
        dashboard: true
      };

    case 'Unifeso':
      return {
        studyGuide: false,
        enamed: true,
        dashboard: false
      };

    case 'Barão de Mauá':
      const hasAccess = semestre === 11 || semestre === 12;
      return {
        studyGuide: hasAccess,
        enamed: hasAccess,
        dashboard: hasAccess
      };

    case 'Integrado':
      return {
        studyGuide: true,
        enamed: false,
        dashboard: true
      };

    case 'Fame':
    case 'Claretiano':
      return {
        studyGuide: true,
        enamed: false,
        dashboard: true
      };

    case 'Faceres':
    case 'Unifip':
      return {
        studyGuide: false,
        enamed: false,
        dashboard: false
      };

    default:
      return {
        studyGuide: false,
        enamed: false,
        dashboard: false
      };
  }
};