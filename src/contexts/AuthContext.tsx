
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User } from '@/types';
import { toast } from '@/hooks/use-toast';

const AuthContext = createContext<AuthContextType | null>(null);

// Mock data - In production, this would come from Athena
const mockUserData: Record<string, User> = {
  'estudante@medicina.com': {
    email: 'estudante@medicina.com',
    name: 'Ana Silva',
    faculty: 'Claretiano',
    semester: 3
  },
  'joao@medicina.com': {
    email: 'joao@medicina.com',
    name: 'João Santos',
    faculty: 'USP',
    semester: 2
  }
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
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock authentication - In production, this would validate against Sanarflix/Athena
    if (email in mockUserData && password.length >= 6) {
      const userData = mockUserData[email];
      setUser(userData);
      localStorage.setItem('sanarflix-user', JSON.stringify(userData));
      
      toast({
        title: "Login realizado com sucesso!",
        description: `Bem-vindo(a), ${userData.name}`,
        duration: 3000,
      });
      
      setIsLoading(false);
      return true;
    }

    toast({
      title: "Erro no login",
      description: "Email ou senha inválidos",
      variant: "destructive",
      duration: 3000,
    });
    
    setIsLoading(false);
    return false;
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
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
