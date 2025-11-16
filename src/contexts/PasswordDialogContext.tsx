import { createContext, useContext, useState, ReactNode } from 'react';

type PasswordDialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const PasswordDialogContext = createContext<PasswordDialogContextValue | null>(null);

export function PasswordDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <PasswordDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </PasswordDialogContext.Provider>
  );
}

export function usePasswordDialog() {
  const ctx = useContext(PasswordDialogContext);
  if (!ctx) throw new Error('usePasswordDialog must be used within PasswordDialogProvider');
  return ctx;
}
