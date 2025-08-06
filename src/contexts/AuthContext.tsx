
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User } from '@/types';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('sanarflix-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Call auth-login edge function
      const { data, error } = await supabase.functions.invoke('auth-login', {
        body: { email, password }
      });

      if (error || !data.success) {
        throw new Error(data?.error || 'Erro na autenticação');
      }

      const userData = data.user;
      setUser(userData);
      localStorage.setItem('sanarflix-user', JSON.stringify(userData));
      
      toast({
        title: "Login realizado com sucesso!",
        description: `Bem-vindo(a), ${userData.name}`,
        duration: 3000,
      });
      
      setIsLoading(false);
      return true;

    } catch (error: any) {
      console.error('Login error:', error);
      
      toast({
        title: "Erro no login",
        description: error.message || "Email ou senha inválidos",
        variant: "destructive",
        duration: 3000,
      });
      
      setIsLoading(false);
      return false;
    }
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    if (!user) return false;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-password', {
        body: { email: user.email, newPassword }
      });

      if (error || !data.success) {
        throw new Error(data?.error || 'Erro ao atualizar senha');
      }

      // Update user state to remove password change requirement
      const updatedUser = { ...user, requiresPasswordChange: false };
      setUser(updatedUser);
      localStorage.setItem('sanarflix-user', JSON.stringify(updatedUser));
      
      toast({
        title: "Senha atualizada!",
        description: "Sua senha foi alterada com sucesso",
        duration: 3000,
      });
      
      setIsLoading(false);
      return true;

    } catch (error: any) {
      console.error('Update password error:', error);
      
      toast({
        title: "Erro ao atualizar senha",
        description: error.message || "Tente novamente",
        variant: "destructive",
        duration: 3000,
      });
      
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sanarflix-user');
    localStorage.removeItem('study-progress');
    
    toast({
      title: "Logout realizado",
      description: "Até logo!",
      duration: 2000,
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updatePassword, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
