import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordChangeModal } from './PasswordChangeModal';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { needsPasswordChange } = useAuth();

  return (
    <>
      {children}
      <PasswordChangeModal isOpen={needsPasswordChange} />
    </>
  );
};