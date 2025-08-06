import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordChangeModal } from '@/components/PasswordChangeModal';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { user } = useAuth();
  
  const handlePasswordChangeClose = () => {
    // This modal cannot be closed until password is changed
    // The modal will close itself when password is successfully changed
  };

  return (
    <>
      {children}
      {user?.requiresPasswordChange && (
        <PasswordChangeModal 
          open={true} 
          onClose={handlePasswordChangeClose}
        />
      )}
    </>
  );
};