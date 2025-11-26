import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordChangeModal } from './PasswordChangeModal';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const authContext = useAuth();
  
  // Previne renderização antes do contexto estar pronto
  if (!authContext) {
    return <>{children}</>;
  }
  
  const { needsPasswordChange } = authContext;

  return (
    <>
      {children}
      <PasswordChangeModal isOpen={needsPasswordChange} />
    </>
  );
};