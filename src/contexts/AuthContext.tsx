import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User } from '@/types';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // User signed in via magic link or other means
          try {
            const { data, error } = await supabase.functions.invoke('auth-login', {
              body: { 
                email: session.user.email,
                sessionToken: session.access_token 
              }
            });

            if (error || data.error) {
              console.error('Auth state change error:', data?.error || error);
              return;
            }

            const userData = data.user;
            setUser(userData);
            setNeedsPasswordChange(data.needsPasswordChange || false);
            
            localStorage.setItem('sanarflix-user', JSON.stringify(userData));
            localStorage.setItem('sanarflix-needs-password-change', (data.needsPasswordChange || false).toString());
            
            toast({
              title: "Login realizado com sucesso!",
              description: `Bem-vindo(a), ${userData.nome}`,
              duration: 3000,
            });
          } catch (error) {
            console.error('Auth state processing error:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setNeedsPasswordChange(false);
          localStorage.removeItem('sanarflix-user');
          localStorage.removeItem('sanarflix-needs-password-change');
        }
      }
    );

    // Check if user is already logged in
    const storedUser = localStorage.getItem('sanarflix-user');
    const storedPasswordChange = localStorage.getItem('sanarflix-needs-password-change');
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setNeedsPasswordChange(storedPasswordChange === 'true');
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('sanarflix-user');
        localStorage.removeItem('sanarflix-needs-password-change');
      }
    }
    
    setIsLoading(false);

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      console.log('Starting login for:', email);
      
      const { data, error } = await supabase.functions.invoke('auth-login', {
        body: { email, password }
      });

      console.log('Login response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        toast({
          title: "Erro no login",
          description: "Erro de comunicação com o servidor",
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
        return false;
      }

      if (data?.error) {
        console.log('Login failed with error:', data.error);
        toast({
          title: "Erro no login",
          description: data.error,
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
        return false;
      }

      if (!data?.user) {
        console.error('No user data in response');
        toast({
          title: "Erro no login",
          description: "Resposta inválida do servidor",
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
        return false;
      }

      const userData = data.user;
      console.log('Login successful for user:', userData.email);

      // Estabelece sessão do Supabase no cliente para permitir RLS nas consultas
      if (data.session?.access_token && data.session?.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          console.log('Supabase session set successfully');
        } catch (e) {
          console.error('Failed to set Supabase session:', e);
        }
      }

      setUser(userData);
      setNeedsPasswordChange(data.needsPasswordChange || false);
      
      localStorage.setItem('sanarflix-user', JSON.stringify(userData));
      localStorage.setItem('sanarflix-needs-password-change', (data.needsPasswordChange || false).toString());
      
      if (data.needsPasswordChange) {
        toast({
          title: "Primeiro acesso detectado",
          description: "É necessário alterar sua senha",
          duration: 5000,
        });
      } else {
        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo(a), ${userData.nome}`,
          duration: 3000,
        });
      }
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Erro no login",
        description: error instanceof Error ? error.message : "Erro interno do servidor",
        variant: "destructive",
        duration: 3000,
      });
      setIsLoading(false);
      return false;
    }
  };

  const changePassword = async (newPassword: string): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-password', {
        body: { userId: user.id, newPassword }
      });

      if (error || data.error) {
        toast({
          title: "Erro ao alterar senha",
          description: data?.error || "Erro interno do servidor",
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
        return false;
      }

      setNeedsPasswordChange(false);
      localStorage.setItem('sanarflix-needs-password-change', 'false');
      
      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua senha foi atualizada",
        duration: 3000,
      });
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Password change error:', error);
      toast({
        title: "Erro ao alterar senha",
        description: "Erro interno do servidor",
        variant: "destructive",
        duration: 3000,
      });
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setNeedsPasswordChange(false);
    localStorage.removeItem('sanarflix-user');
    localStorage.removeItem('sanarflix-needs-password-change');
    localStorage.removeItem('study-progress');
    
    toast({
      title: "Logout realizado",
      description: "Até logo!",
      duration: 2000,
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isLoading, 
      needsPasswordChange, 
      changePassword 
    }}>
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