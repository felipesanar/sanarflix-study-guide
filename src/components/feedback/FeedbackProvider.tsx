import React, { createContext, useCallback, useContext, useState } from 'react';
import { FeedbackSheet } from './FeedbackSheet';

export type FeedbackCategory = 'bug' | 'suggestion' | 'feature_request' | 'praise';

interface FeedbackContextValue {
  open: boolean;
  initialCategory: FeedbackCategory | null;
  openFeedback: (category?: FeedbackCategory) => void;
  closeFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [initialCategory, setInitialCategory] = useState<FeedbackCategory | null>(null);

  const openFeedback = useCallback((category?: FeedbackCategory) => {
    setInitialCategory(category ?? null);
    setOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setOpen(false);
    setInitialCategory(null);
  }, []);

  return (
    <FeedbackContext.Provider value={{ open, initialCategory, openFeedback, closeFeedback }}>
      {children}
      <FeedbackSheet
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : closeFeedback())}
        initialCategory={initialCategory}
      />
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
};
