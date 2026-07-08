import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FeedbackSheet } from './FeedbackSheet';

export type FeedbackCategory = 'bug' | 'suggestion' | 'feature_request' | 'praise';
export type FeedbackAudience = 'aluno' | 'gestor';

interface FeedbackContextValue {
  open: boolean;
  initialCategory: FeedbackCategory | null;
  audience: FeedbackAudience;
  openFeedback: (category?: FeedbackCategory) => void;
  closeFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

const GESTOR_ROLES = new Set(['gestor', 'gestor_grupo', 'gestor_formal']);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [initialCategory, setInitialCategory] = useState<FeedbackCategory | null>(null);

  const audience: FeedbackAudience = useMemo(() => {
    const roles = user?.roles ?? [];
    // Aluno também pode ter role de gestor secundário; só reclassificamos como
    // gestor quando NENHUMA role de aluno estiver presente — o feedback deve
    // seguir o portal ativo, então priorizamos aluno quando ambíguo.
    const hasAluno = roles.some((r) => r === 'aluno' || r === 'user');
    const isGestor = roles.some((r) => GESTOR_ROLES.has(r));
    if (isGestor && !hasAluno) return 'gestor';
    // Também considera a rota atual: se está dentro de /gestor, trata como gestor.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/gestor') && isGestor) {
      return 'gestor';
    }
    return 'aluno';
  }, [user?.roles]);

  const openFeedback = useCallback((category?: FeedbackCategory) => {
    setInitialCategory(category ?? null);
    setOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setOpen(false);
    setInitialCategory(null);
  }, []);

  return (
    <FeedbackContext.Provider value={{ open, initialCategory, audience, openFeedback, closeFeedback }}>
      {children}
      <FeedbackSheet
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : closeFeedback())}
        initialCategory={initialCategory}
        audience={audience}
      />
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
};
