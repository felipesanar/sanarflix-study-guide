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
    case 'FUNEPE':
    case 'FAMP':
      return {
        studyGuide: true,
        enamed: true,
        dashboard: true
      };

    case 'UNIFESO':
      return {
        studyGuide: false,
        enamed: true,
        dashboard: false
      };

    case 'BARÃO':
      const hasAccess = semestre === 11 || semestre === 12;
      return {
        studyGuide: hasAccess,
        enamed: hasAccess,
        dashboard: hasAccess
      };

    case 'INTEGRADO':
      return {
        studyGuide: true,
        enamed: false,
        dashboard: true
      };

    case 'FAME':
    case 'Claretiano':
      return {
        studyGuide: true,
        enamed: false,
        dashboard: true
      };

    case 'FACERES':
    case 'UNIFIP':
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