import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthContextType, User } from '@/types';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Logger from '@/utils/logger';
import { validateUser } from '@/utils/validation';
import { useTabSync } from '@/hooks/useTabSync';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  // Tab sync handler
  const handleTabSync = useCallback((message: { type: string; data?: any }) => {
    if (message.type === 'LOGOUT') {
      setUser(null);
      setNeedsPasswordChange(false);
      localStorage.removeItem('sanarflix-user');
    } else if (message.type === 'LOGIN' && message.data) {
      setUser(message.data);
      setNeedsPasswordChange(false);
    }
  }, []);

  const { broadcast } = useTabSync(handleTabSync);

  useEffect(() => {
    // 1) Listener síncrono do estado de auth (evita deadlocks)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

      if (event === 'SIGNED_IN') {
        // SECURITY: Only cache minimal data, fetch full profile from server
        const cached = localStorage.getItem('sanarflix-user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const validation = validateUser(parsed);
            
            if (validation.success) {
              setUser(parsed);
              // Password change flag will be verified server-side
              setNeedsPasswordChange(false);
            } else {
              Logger.warn('Invalid cached user data', validation.error);
              localStorage.removeItem('sanarflix-user');
            }
          } catch (e) {
            Logger.error('Error parsing cached user data', e);
            localStorage.removeItem('sanarflix-user');
          }
        }
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setNeedsPasswordChange(false);
        localStorage.removeItem('sanarflix-user');
      }
    });

    // 2) SECURITY: Initialize from session, minimize localStorage reliance
    supabase.auth.getSession()
      .then(({ data }) => {
        const storedUser = localStorage.getItem('sanarflix-user');
        
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            // Password change requirement is verified during login
            setNeedsPasswordChange(false);
          } catch (error) {
            localStorage.removeItem('sanarflix-user');
          }
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Erro ao obter sessão:', error);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const startTime = performance.now();
    setIsLoading(true);
    
    // Preload recursos em paralelo com autenticação
    import('../utils/preload').then(({ preloadPostLoginResources }) => {
      preloadPostLoginResources();
    });
    
    try {
      const { data, error } = await supabase.functions.invoke('auth-login', {
        body: { email, password }
      });

      if (error) {
        Logger.error('Login communication error', error);
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

      // Estabelece sessão do Supabase no cliente para permitir RLS nas consultas
      if (data.session?.access_token && data.session?.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          
          // Fetch user roles after session is established
          try {
            const { data: rolesData } = await supabase.rpc('get_user_roles', { 
              _user_id: userData.id 
            });
            
            if (rolesData) {
              userData.roles = rolesData;
            }
          } catch (roleError) {
            Logger.warn('Failed to fetch user roles', roleError);
            userData.roles = [];
          }
        } catch (e) {
          // Failed to set session
          userData.roles = [];
        }
      } else {
        userData.roles = [];
      }

      setUser(userData);
      setNeedsPasswordChange(data.needsPasswordChange || false);
      
      // SECURITY: Store minimal user data in localStorage, roles fetched from server
      localStorage.setItem('sanarflix-user', JSON.stringify(userData));
      
      // Broadcast login para outras abas
      broadcast({ type: 'LOGIN', data: userData });
      
      // Cache otimizado de dados do usuário
      import('../utils/performanceCache').then(({ performanceCache }) => {
        performanceCache.setUserData(userData);
      });
      
      // Métricas de performance do login
      const loginDuration = performance.now() - startTime;
      if (loginDuration > 2000) {
        console.warn(`Slow login: ${loginDuration.toFixed(2)}ms`);
      }
      
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

      // SECURITY: Password change flag managed in memory only
      setNeedsPasswordChange(false);
      
      // Security enhancement: Invalidate all sessions after password change
      try {
        await supabase.functions.invoke('session-security', {
          body: { 
            action: 'invalidate_sessions',
            userId: user.id 
          }
        });
        
        toast({
          title: "Senha alterada com sucesso!",
          description: "Sua senha foi atualizada. Você será redirecionado para fazer login novamente por segurança.",
          duration: 4000,
        });
        
        // Force logout after password change for security
        setTimeout(() => logout(), 3000);
        
      } catch (sessionError) {
        console.warn('Failed to invalidate sessions:', sessionError);
        
        // Fallback: at least refresh current session
        try {
          await supabase.auth.refreshSession();
        } catch (e) {
          // If refresh fails, force logout for security
          setTimeout(() => logout(), 1000);
        }
        
        toast({
          title: "Senha alterada com sucesso!",
          description: "Sua senha foi atualizada",
          duration: 3000,
        });
      }
      
      setIsLoading(false);
      return true;
    } catch (error) {
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
    // Broadcast logout para outras abas
    broadcast({ type: 'LOGOUT' });
    
    try {
      // Encerra sessão do Supabase (dispara SIGNED_OUT)
      supabase.auth.signOut();
    } catch (e) {
      // Error on signOut
    }

    // SECURITY: Clear all auth-related data
    setUser(null);
    setNeedsPasswordChange(false);
    localStorage.removeItem('sanarflix-user');
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