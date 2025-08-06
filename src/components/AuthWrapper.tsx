import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordChangeModal } from './PasswordChangeModal';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { user } = useAuth();
  
  // Show password change modal if user requires password change
  const showPasswordModal = user?.requiresPasswordChange || false;

  return (
    <>
      {children}
      <PasswordChangeModal isOpen={showPasswordModal} />
    </>
  );
};