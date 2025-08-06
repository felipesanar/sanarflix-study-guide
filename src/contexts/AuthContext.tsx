
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User } from '@/types';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const AuthContext = createContext<AuthContextType | null>(null);

// Map IES IDs to faculty names
const iesIdToFaculty: Record<string, string> = {
  '954aad2f-4030-4d5d-b27a-19eb8fac05cf': 'FUNEPE',
  '12cfa7f2-45ba-406f-9e4d-aa719a6b94ca': 'FAMP',
  '6029b69d-a2ef-4de5-b907-91f88122bb4e': 'CLARETIANO',
  // Add other IES IDs as needed
};

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
      const { data, error } = await supabase.functions.invoke('auth-login', {
        body: { email, password }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        toast({
          title: "Erro no login",
          description: data.error || "Email ou senha inválidos",
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
        return false;
      }

      const userData: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.nome,
        faculty: iesIdToFaculty[data.user.id_ies] || 'Desconhecida',
        semester: data.user.semestre,
        requiresPasswordChange: data.requiresPasswordChange,
      };

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
      toast({
        title: "Erro no login",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
        duration: 3000,
      });
      
      setIsLoading(false);
      return false;
    }
  };

  const changePassword = async (newPassword: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.functions.invoke('change-password', {
        body: { 
          userId: user.id,
          newPassword 
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        toast({
          title: "Erro ao alterar senha",
          description: data.error || "Erro desconhecido",
          variant: "destructive",
          duration: 3000,
        });
        return false;
      }

      // Update user state to remove password change requirement
      const updatedUser = { ...user, requiresPasswordChange: false };
      setUser(updatedUser);
      localStorage.setItem('sanarflix-user', JSON.stringify(updatedUser));

      return true;

    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
        duration: 3000,
      });
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
    <AuthContext.Provider value={{ user, login, logout, changePassword, isLoading }}>
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
