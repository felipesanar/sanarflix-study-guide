import { AccessRules, User } from '@/types';

/**
 * IES IDs e suas configurações
 * 
 * TODO: Migrar para tabela ies_features no banco de dados
 * para permitir configuração dinâmica sem deploy
 * 
 * Estrutura futura sugerida:
 * CREATE TABLE ies_features (
 *   ies_id UUID REFERENCES ies(id),
 *   feature_key TEXT,
 *   enabled BOOLEAN DEFAULT false,
 *   PRIMARY KEY (ies_id, feature_key)
 * );
 */

// B2C: Usuários cadastrados via página de cadastro público
const B2C_IES_ID = 'abec7c7d-ef07-4871-9e19-090f4d951e5e';

// FAME: IES com acesso especial para semestre 0
const FAME_IES_ID = '954aad2f-4030-4d5d-b27a-19eb8fac05cf';

// Mapeamento de IES para suas features
// Formato: { [ies_id]: { nome, features } }
const IES_CONFIG: Record<string, { nome: string; features: Partial<AccessRules> }> = {
  // B2B IES (fallback se não tiver role)
  '9f21b138-0027-44c8-9660-dc6706d57bc0': {
    nome: 'IES B2B Padrão',
    features: {
      studyGuide: true,
      enamed: true,
      dashboard: true,
      SimuladoDesempenho: true,
    }
  },
  
  // UNICEUB
  '954aad2f-4030-4d5d-b27a-19eb8fac05cf': {
    nome: 'UNICEUB',
    features: {
      studyGuide: true,
      enamed: true,
      dashboard: true,
    }
  },
  
  // UniAtenas Paracatu
  '12cfa7f2-45ba-406f-9e4d-aa719a6b94ca': {
    nome: 'UniAtenas Paracatu',
    features: {
      enamed: true,
      SimuladoDesempenho: true,
    }
  },
  
  // UniAtenas Passos
  '3e51663e-8766-4881-bfd1-0921678ed014': {
    nome: 'UniAtenas Passos',
    features: {
      enamed: true,
      SimuladoDesempenho: true,
    }
  },
  
  // UniAtenas Patos de Minas
  '5c6e697f-853c-415b-8690-65a27a9384f0': {
    nome: 'UniAtenas Patos de Minas',
    features: {
      enamed: true,
      SimuladoDesempenho: true,
    }
  },
  
  // UniAtenas Sete Lagoas
  '314b3bb2-a758-42d6-a9bb-e68e2fb35bba': {
    nome: 'UniAtenas Sete Lagoas',
    features: {
      enamed: true,
      SimuladoDesempenho: true,
    }
  },
  
  // USCS - Universidade Municipal de São Caetano do Sul
  'e40a0ec1-1150-40e6-b492-8b8e3f8db593': {
    nome: 'USCS',
    features: {
      SimuladoDesempenho: true,
      intensivoUSCS: true, // Página exclusiva USCS
    }
  },
};

/**
 * Regras de acesso padrão (base para todos os usuários)
 */
const DEFAULT_RULES: AccessRules = {
  home: false,
  studyGuide: false,
  enamed: false,
  cronogramaEnamed: false,
  dashboard: false,
  SimuladoDesempenho: false,
  userManagement: false,
  intensivoUSCS: false,
  sanarclass: false,
  simulados: true,
  analytics: false,
};

/**
 * Verifica se usuário tem role de admin ou b2b_partner
 */
export const isB2BUser = (user: User | null): boolean => {
  if (!user) return false;
  return user.roles?.includes('admin') || user.roles?.includes('b2b_partner') || false;
};

/**
 * Obtém regras de acesso baseadas no usuário
 * 
 * Hierarquia de permissões:
 * 1. Usuário não autenticado → regras mínimas
 * 2. Admin/B2B Partner → acesso total (exceto intensivoUSCS)
 * 3. Usuário B2C → apenas cronograma ENAMED
 * 4. Usuário de IES configurada → features específicas
 * 5. Usuário de IES não configurada → default + ENAMED
 */
export const getAccessRules = (user: User | null): AccessRules => {
  // Usuário não autenticado
  if (!user) {
    return { ...DEFAULT_RULES };
  }
  
  const { id_ies, roles } = user;

  const isAdmin = roles?.includes('admin') || false;
  const isB2BPartner = roles?.includes('b2b_partner') || false;
  
  if (isAdmin || isB2BPartner) {
    return {
      ...DEFAULT_RULES,
      home: true,
      studyGuide: true,
      enamed: true,
      dashboard: true,
      SimuladoDesempenho: true,
      userManagement: isAdmin,
      sanarclass: true,
    };
  }

  // FAME com semestre = 0: acesso a Home, Guia de Estudos e SanarClass
  if (id_ies === FAME_IES_ID && user.semestre === 0) {
    return {
      ...DEFAULT_RULES,
      home: true,
      studyGuide: true,
      dashboard: true,
      enamed: true,
      SimuladoDesempenho: true,
      sanarclass: true,
    };
  }

  if (id_ies === B2C_IES_ID) {
    return {
      ...DEFAULT_RULES,
      cronogramaEnamed: true,
    };
  }
  
  // IES específica configurada
  const iesConfig = id_ies ? IES_CONFIG[id_ies] : null;
  
  if (iesConfig) {
    return {
      ...DEFAULT_RULES,
      ...iesConfig.features,
    };
  }
  
  // IES não configurada: default + ENAMED
  return {
    ...DEFAULT_RULES,
    enamed: true,
  };
};
