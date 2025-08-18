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
    console.log('AuthContext: Setting up auth state listener');
    
    // 1) Listener síncrono do estado de auth (evita deadlocks)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthContext: Auth state changed:', event, session?.user?.email);

      if (event === 'SIGNED_IN') {
        // Hidrata imediatamente com cache salvo no login()
        const cached = localStorage.getItem('sanarflix-user');
        const cachedNeeds = localStorage.getItem('sanarflix-needs-password-change');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setUser(parsed);
            setNeedsPasswordChange(cachedNeeds === 'true');
          } catch (e) {
            console.error('Error parsing cached user on SIGNED_IN:', e);
          }
        } else if (session?.access_token) {
          // Fluxo via magic link/callback: buscar perfil de forma deferida
          setTimeout(async () => {
            try {
              const { data, error } = await supabase.functions.invoke('auth-login', {
                body: { 
                  email: session.user?.email,
                  sessionToken: session.access_token 
                }
              });

              if (error || data?.error) {
                console.error('Auth state profile fetch error:', data?.error || error);
                return;
              }

              const userData = data.user;
              setUser(userData);
              setNeedsPasswordChange(data.needsPasswordChange || false);
              
              localStorage.setItem('sanarflix-user', JSON.stringify(userData));
              localStorage.setItem('sanarflix-needs-password-change', (data.needsPasswordChange || false).toString());
            } catch (e) {
              console.error('Deferred profile fetch error:', e);
            }
          }, 0);
        }
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setNeedsPasswordChange(false);
        localStorage.removeItem('sanarflix-user');
        localStorage.removeItem('sanarflix-needs-password-change');
      }
    });

    // 2) Inicializa a partir da sessão e do cache existente
    supabase.auth.getSession()
      .then(({ data }) => {
        const storedUser = localStorage.getItem('sanarflix-user');
        const storedPasswordChange = localStorage.getItem('sanarflix-needs-password-change');
        
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
            setNeedsPasswordChange(storedPasswordChange === 'true');
          } catch (error) {
            console.error('Error parsing stored user on init:', error);
            localStorage.removeItem('sanarflix-user');
            localStorage.removeItem('sanarflix-needs-password-change');
          }
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('getSession error:', error);
        setIsLoading(false);
      });

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
      console.log('Response data details:', data);

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
      console.log('Login successful for user:', userData);
      console.log('Setting user state with userData:', userData);

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

      console.log('Before setUser - current user state:', user);
      setUser(userData);
      setNeedsPasswordChange(data.needsPasswordChange || false);
      console.log('After setUser - should have user now');
      
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
      console.log('About to return true from login function');
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
    try {
      // Encerra sessão do Supabase (dispara SIGNED_OUT)
      supabase.auth.signOut();
    } catch (e) {
      console.error('Error on signOut:', e);
    }

    // Limpeza defensiva imediata
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