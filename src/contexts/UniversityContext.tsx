import React, { createContext, useContext, useState, ReactNode } from 'react';

// Tipos de promoções que podem ser exibidas
export type PromotionType = 'premium' | 'university' | 'event' | 'default';

// Interface para dados de promoção
export interface PromotionData {
  type: PromotionType;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  universityId?: string;
  imageUrl?: string;
}

// Mapeamento de universidades para promoções específicas
const universityPromotions: Record<string, PromotionData> = {
  'univ-001': {
    type: 'university',
    title: 'Parceria UFMG',
    description: 'Acesso exclusivo a materiais preparatórios para residência médica',
    ctaText: 'Ver detalhes',
    ctaLink: 'https://www.sanarmed.com/ufmg',
    universityId: 'univ-001',
  },
  'univ-002': {
    type: 'event',
    title: 'Congresso USP',
    description: 'Participe do maior congresso de medicina do Brasil com desconto exclusivo',
    ctaText: 'Inscrever-se',
    ctaLink: 'https://www.sanarmed.com/congresso-usp',
    universityId: 'univ-002',
  },
};

// Promoção padrão quando não há específica para a universidade
const defaultPromotion: PromotionData = {
  type: 'premium',
  title: 'Sanar Premium',
  description: 'Acesse conteúdos exclusivos, questões comentadas e materiais complementares para sua formação médica.',
  ctaText: 'Conhecer agora',
  ctaLink: 'https://www.sanarmed.com',
};

// Interface do contexto
interface UniversityContextType {
  universityId: string | null;
  setUniversityId: (id: string | null) => void;
  currentPromotion: PromotionData;
}

// Criação do contexto
const UniversityContext = createContext<UniversityContextType | undefined>(undefined);

// Provider do contexto
export const UniversityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [universityId, setUniversityId] = useState<string | null>(null);

  // Determina qual promoção exibir com base na universidade
  const currentPromotion = universityId && universityPromotions[universityId] 
    ? universityPromotions[universityId] 
    : defaultPromotion;

  return (
    <UniversityContext.Provider value={{ universityId, setUniversityId, currentPromotion }}>
      {children}
    </UniversityContext.Provider>
  );
};

// Hook para usar o contexto
export const useUniversity = () => {
  const context = useContext(UniversityContext);
  if (context === undefined) {
    throw new Error('useUniversity deve ser usado dentro de um UniversityProvider');
  }
  return context;
};