import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContextType, User } from '@/types';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Logger from '@/utils/logger';
import { validateUser } from '@/utils/validation';
import { useTabSync } from '@/hooks/useTabSync';

export const AuthContext = createContext<AuthContextType | null>(null);

const REFRESH_THROTTLE_MS = 30_000; // 30 seconds

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  // Impersonation state
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [realAdminUser, setRealAdminUser] = useState<User | null>(null);

  /**
   * Fetches fresh user profile from public.users + ies + roles,
   * updating state and localStorage cache.
   */
  const refreshUserProfile = useCallback(async (userId: string) => {
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
    lastRefreshRef.current = now;

    try {
      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from('users')
          .select('id, email, nome, id_ies, semestre, ies:id_ies(nome)')
          .eq('id', userId)
          .maybeSingle(),
        supabase.rpc('get_user_roles', { _user_id: userId }),
      ]);

      if (profileResult.error) {
        Logger.warn('refreshUserProfile: query error', profileResult.error);
        return;
      }

      if (!profileResult.data) {
        Logger.warn('refreshUserProfile: user not found', { userId });
        return;
      }

      const row = profileResult.data as any;
      const iesNome = row.ies?.nome ?? '';
      const roles = rolesResult.data ?? [];

      const updated: User = {
        id: row.id,
        email: row.email,
        nome: row.nome,
        id_ies: row.id_ies ?? '',
        ies_nome: iesNome,
        semestre: row.semestre ?? undefined,
        roles,
      };

      setUser(updated);
      localStorage.setItem('sanarflix-user', JSON.stringify(updated));
      Logger.debug('refreshUserProfile: updated', { userId, ies_nome: iesNome, semestre: row.semestre });
    } catch (e) {
      Logger.warn('refreshUserProfile: unexpected error', e);
    }
  }, []);

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
        const cached = localStorage.getItem('sanarflix-user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const validation = validateUser(parsed);
            
            if (validation.success) {
              setUser(parsed);
              setNeedsPasswordChange(false);
              // Refresh profile in background to get fresh data
              refreshUserProfile(parsed.id);
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

    // 2) Initialize from session
    supabase.auth.getSession()
      .then(({ data }) => {
        const storedUser = localStorage.getItem('sanarflix-user');
        
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            setNeedsPasswordChange(false);
            // Refresh profile in background to get fresh data
            refreshUserProfile(parsed.id);
          } catch (error) {
            localStorage.removeItem('sanarflix-user');
          }
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Erro ao obter sessão:', error);
        
        const isRefreshTokenError = 
          error?.message?.includes('Invalid Refresh Token') || 
          error?.message?.includes('Refresh Token Not Found') ||
          (error?.name === 'AuthApiError' && error?.status === 400);

        if (isRefreshTokenError) {
          Logger.warn('Refresh token inválido detectado. Limpando sessão.');
          localStorage.removeItem('sanarflix-user');
          localStorage.removeItem('study-progress');
          supabase.auth.signOut().catch(() => {});
          setUser(null);
        }
        
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [refreshUserProfile]);

  // Refresh profile when window gains focus (visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        refreshUserProfile(user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.id, refreshUserProfile]);

  const login = async (email: string, password: string): Promise<boolean> => {
    const startTime = performance.now();
    setIsLoading(true);
    
    import('../utils/preload').then(({ preloadPostLoginResources }) => {
      preloadPostLoginResources();
    });
    
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const emailMasked = normalizedEmail.replace(/(.{2}).+(@.*)/, '$1***$2');
      Logger.userAction('login_attempt', { email: emailMasked, domain: normalizedEmail.split('@')[1] || '' });
      const { data, error } = await supabase.functions.invoke('auth-login', {
        body: { email: normalizedEmail, password }
      });
      Logger.debug('login_edge_function_response', { hasData: !!data, hasError: !!error, status: (error as any)?.context?.status });

      let contextualMessage: string | undefined;
      const maybeBody = (error as any)?.context?.body;
      if (!data?.error && typeof maybeBody === 'string') {
        try {
          const parsed = JSON.parse(maybeBody);
          if (parsed?.error) contextualMessage = String(parsed.error);
        } catch {
          // ignore
        }
      }

      const errorMessage = data?.error || contextualMessage || error?.message;
      
      if (error && !data) {
        Logger.error('Login communication error', error);
        Logger.debug('login_error_context', { status: (error as any)?.context?.status, body: (error as any)?.context?.body });
        toast({
          title: "Erro no login",
          description: "Erro de comunicação com o servidor. Verifique sua conexão.",
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
        return false;
      }

      if (errorMessage) {
        Logger.warn('Login failed', { message: errorMessage });
        toast({
          title: "Erro no login",
          description: errorMessage,
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
        return false;
      }

      if (!data?.user) {
        Logger.error('Login invalid response', data);
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

      if (data.session?.access_token && data.session?.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          
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
          userData.roles = [];
        }
      } else {
        userData.roles = [];
      }

      setUser(userData);
      setNeedsPasswordChange(data.needsPasswordChange || false);
      
      localStorage.setItem('sanarflix-user', JSON.stringify(userData));
      Logger.info('login_success', { user_id: userData.id, needsPasswordChange: data.needsPasswordChange || false, roles_count: Array.isArray(userData.roles) ? userData.roles.length : 0 });
      
      broadcast({ type: 'LOGIN', data: userData });
      
      import('../utils/performanceCache').then(({ performanceCache }) => {
        performanceCache.setUserData(userData);
      });
      
      const loginDuration = performance.now() - startTime;
      Logger.performance('login', loginDuration, { user_id: userData.id });
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
      Logger.error('login_unexpected_error', error);
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
        
        setTimeout(() => logout(), 3000);
        
      } catch (sessionError) {
        console.warn('Failed to invalidate sessions:', sessionError);
        
        try {
          await supabase.auth.refreshSession();
        } catch (e) {
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
    broadcast({ type: 'LOGOUT' });
    
    supabase.auth.signOut().catch((err) => {
      if (import.meta.env.DEV) {
        console.debug('Supabase signOut failed (safe to ignore):', err);
      }
    });

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

  const forceRefreshProfile = useCallback(async () => {
    if (!user?.id) return;
    // Bypass throttle by resetting ref
    lastRefreshRef.current = 0;
    await refreshUserProfile(user.id);
  }, [user?.id, refreshUserProfile]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isLoading, 
      needsPasswordChange, 
      changePassword,
      forceRefreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider. Make sure the component is wrapped in <AuthProvider>.');
  }
  return context;
};
