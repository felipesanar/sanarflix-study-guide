import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContextType, User } from '@/types';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Logger from '@/utils/logger';
import { validateUser } from '@/utils/validation';
import { useTabSync } from '@/hooks/useTabSync';
import { Access, EMPTY_ACCESS, can, deriveAccessFromRoles } from '@/experiences/access';
import { authService } from '@/services/authService';
import { logAdminAction } from '@/services/admin/logAction';

export const AuthContext = createContext<AuthContextType | null>(null);

const REFRESH_THROTTLE_MS = 30_000; // 30 seconds

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  // Access (experiências + capabilities) do usuário REAL (não impersonado).
  // EMPTY_ACCESS é neutro (só experiência 'aluno', sem capabilities) — nunca
  // undefined, mesmo antes do primeiro refreshUserProfile completar.
  const [realAccess, setRealAccess] = useState<Access>(EMPTY_ACCESS);

  // Impersonation state
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [realAdminUser, setRealAdminUser] = useState<User | null>(null);
  const [impersonatedAccess, setImpersonatedAccess] = useState<Access | null>(null);
  // Ref (não state) para refreshUserProfile checar impersonação sem precisar
  // depender de impersonatedUser e recriar seu useCallback a cada troca.
  // Durante impersonação, `user` state passa a apontar para o usuário
  // impersonado (comportamento pré-existente) — sem essa guarda, um refresh
  // em background (ex.: visibilitychange) sobrescreveria realAccess com o
  // access do impersonado.
  const isImpersonatingRef = useRef(false);

  // Ref auxiliar (não state) que espelha o `user.id` atual sem closure stale.
  // refreshUserProfile usa isso para detectar, ao terminar, se o usuário
  // logado mudou enquanto o fetch estava em voo (ex.: stopImpersonation
  // rodou no meio do caminho de um refresh disparado para o id impersonado).
  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  /**
   * Fetches fresh user profile from public.users + ies + roles,
   * updating state and localStorage cache.
   */
  const refreshUserProfile = useCallback(async (userId: string, force = false) => {
    // Durante impersonação, nunca roda em background: sem essa guarda, um
    // refresh disparado (ex.: visibilitychange) com o id do impersonado
    // gravava o perfil dele em localStorage incondicionalmente, prendendo
    // o admin como "aluno" após um reload — sem banner, sem console, sem
    // autocorreção (P1). Opção mais segura: pular o refresh inteiro.
    if (isImpersonatingRef.current) return;

    const now = Date.now();
    // Bypass throttle when forced OR when the cached user has no roles —
    // prevents a stale "empty roles" cache from surviving after a role
    // (e.g. gestor_grupo) was just granted in the backend.
    let cachedRolesEmpty = false;
    try {
      const cachedRaw = typeof window !== 'undefined' ? localStorage.getItem('sanarflix-user') : null;
      const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
      cachedRolesEmpty = !Array.isArray(cached?.roles) || cached.roles.length === 0;
    } catch (e) {
      // localStorage corrompido — limpa para evitar loop e segue como se vazio.
      try { localStorage.removeItem('sanarflix-user'); } catch { /* noop */ }
      cachedRolesEmpty = true;
      // eslint-disable-next-line no-console
      Logger.warn('[AuthContext] cached profile inválido, limpando', e);
    }
    if (!force && !cachedRolesEmpty && now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
    lastRefreshRef.current = now;

    try {
      const [profileResult, rolesResult, accessibleIdsResult, groupsResult, accessResult] = await Promise.all([
        supabase
          .from('users')
          .select('id, email, nome, id_ies, semestre, telefone, ies:id_ies(nome)')
          .eq('id', userId)
          .maybeSingle(),
        supabase.rpc('get_user_roles', { _user_id: userId }),
        supabase.rpc('get_accessible_ies', { _user: userId }),
        supabase
          .from('user_groups')
          // group_ies é embutido POR DENTRO de educational_groups: não existe FK
          // user_groups→group_ies (só user_groups→educational_groups), então o
          // pivô é educational_groups, que tem FK real para group_ies e para ies.
          .select('group_id, educational_groups:group_id (id, name, group_ies (ies:ies_id (id, nome)))')
          .eq('user_id', userId),
        // get_access ainda pode não existir no banco/types — validamos com
        // fetchAccessPayload e resolvemos o fallback abaixo já com as roles
        // corretas (get_user_roles roda em paralelo, então não está pronto aqui).
        authService.fetchAccessPayload(),
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
      // accessResult é null se a RPC get_access falhou/não existe/payload inválido —
      // nesse caso caímos no espelho client-side com as roles reais (já disponíveis).
      const access = accessResult ?? deriveAccessFromRoles(roles);

      const accessibleIds = (accessibleIdsResult.data as string[] | null) ?? [];
      let accessibleIes: { id: string; nome: string }[] = [];
      if (accessibleIds.length > 0) {
        const { data: iesRows } = await supabase
          .from('ies')
          .select('id, nome')
          .in('id', accessibleIds)
          .order('nome');
        accessibleIes = (iesRows ?? []).map((r: any) => ({ id: r.id, nome: r.nome }));
      }
      const groups = ((groupsResult.data as any[]) ?? []).map((g) => ({
        id: g.educational_groups?.id ?? g.group_id,
        name: g.educational_groups?.name ?? '',
        ies: Array.isArray(g.educational_groups?.group_ies)
          ? g.educational_groups.group_ies
              .map((gi: any) => gi.ies)
              .filter(Boolean)
          : [],
      }));

      const updated: User = {
        id: row.id,
        email: row.email,
        nome: row.nome,
        id_ies: row.id_ies ?? '',
        ies_nome: iesNome,
        semestre: row.semestre ?? undefined,
        telefone: row.telefone ?? null,
        roles,
        accessible_ies: accessibleIes,
        groups,
      };

      // Descarta o resultado se o usuário logado mudou enquanto este fetch
      // estava em voo (ex.: stopImpersonation rodou no meio do caminho de um
      // refresh que havia sido disparado para o id do usuário impersonado).
      // Sem isso, o admin real podia ser rebaixado a aluno silenciosamente,
      // sem banner (P1).
      if (currentUserIdRef.current !== userId) {
        Logger.debug('refreshUserProfile: resultado descartado, usuário mudou durante o fetch', {
          requested: userId,
          current: currentUserIdRef.current,
        });
        return;
      }

      setUser(updated);
      if (!isImpersonatingRef.current) {
        setRealAccess(access);
      }
      // Trade-off documentado (auditoria 🟡 MED — PII em localStorage):
      // O perfil completo é persistido para hidratação rápida em reloads,
      // evitando flash de "loading" enquanto refreshUserProfile completa
      // a fonte de verdade. Mitigação contra XSS: CSP estrita + Trusted
      // Types (fora deste arquivo). Não encriptamos pois XSS exfiltra o
      // mesmo JS context que faria o decrypt. refreshUserProfile sempre
      // roda em background após hidratação, então valores em cache são
      // sobrescritos quase imediatamente em qualquer fluxo de auth.
      localStorage.setItem('sanarflix-user', JSON.stringify(updated));
      Logger.info('[Auth] role from DB:', roles);
      Logger.info('[Auth] Accessible colleges:', accessibleIes.map((i) => i.nome));
      Logger.info('[Auth] Group context:', groups.map((g) => g.name));
      Logger.debug('refreshUserProfile: updated', { userId, ies_nome: iesNome, semestre: row.semestre, roles });
    } catch (e) {
      Logger.warn('refreshUserProfile: unexpected error', e);
    }
  }, []);

  // Tab sync handler
  const handleTabSync = useCallback((message: { type: string; data?: any }) => {
    if (message.type === 'LOGOUT') {
      setUser(null);
      setRealAccess(EMPTY_ACCESS);
      setNeedsPasswordChange(false);
      localStorage.removeItem('sanarflix-user');
    } else if (message.type === 'LOGIN' && message.data) {
      setUser(message.data);
      setRealAccess(deriveAccessFromRoles(message.data.roles));
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
              setRealAccess(deriveAccessFromRoles(parsed.roles));
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
        setRealAccess(EMPTY_ACCESS);
        setNeedsPasswordChange(false);
        localStorage.removeItem('sanarflix-user');
      }
    });

    // 2) Initialize from session
    supabase.auth.getSession()
      .then(({ data }) => {
        const storedUser = localStorage.getItem('sanarflix-user');

        if (storedUser) {
          if (!data.session) {
            // Cache presente mas sessão nula (token revogado/expirado sem
            // refresh): sem essa checagem o usuário ficava "autenticado" no
            // client enquanto toda query falhava silenciosamente por falta
            // de sessão real. Limpa o cache e mantém user null — cai no login.
            localStorage.removeItem('sanarflix-user');
          } else {
            try {
              const parsed = JSON.parse(storedUser);
              setUser(parsed);
              setRealAccess(deriveAccessFromRoles(parsed.roles));
              setNeedsPasswordChange(false);
              // Refresh profile in background to get fresh data
              refreshUserProfile(parsed.id);
            } catch (error) {
              localStorage.removeItem('sanarflix-user');
            }
          }
        }
        setIsLoading(false);
      })
      .catch((error) => {
        Logger.error('Erro ao obter sessão:', error);
        
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
      const edgeStatus = (error as any)?.context?.status;
      Logger.debug('login_edge_function_response', { hasData: !!data, hasError: !!error, status: edgeStatus });

      // Extract error message from edge function response body (even on non-2xx)
      let edgeErrorMessage: string | undefined;
      if (error) {
        const maybeBody = (error as any)?.context?.body;
        if (typeof maybeBody === 'string') {
          try {
            const parsed = JSON.parse(maybeBody);
            if (parsed?.error) edgeErrorMessage = String(parsed.error);
          } catch {
            // not JSON
          }
        }
        // Also check if data was returned alongside the error (some SDK versions)
        if (!edgeErrorMessage && data?.error) {
          edgeErrorMessage = String(data.error);
        }
      }

      const errorMessage = data?.error || edgeErrorMessage;

      // Determine user-friendly message based on HTTP status
      if (error && !data) {
        const isAuthError = edgeStatus === 401 || edgeStatus === 404;
        const isServerError = edgeStatus >= 500;
        
        let description: string;
        if (isAuthError && edgeErrorMessage) {
          // Edge function returned a known auth error (invalid credentials, profile not found)
          description = edgeErrorMessage;
        } else if (isAuthError) {
          description = 'Email ou senha inválidos. Verifique suas credenciais.';
        } else if (isServerError) {
          description = 'Erro interno do servidor. Tente novamente em instantes.';
        } else if (!navigator.onLine) {
          description = 'Sem conexão com a internet. Verifique sua rede.';
        } else {
          description = 'Erro de comunicação com o servidor. Verifique sua conexão e tente novamente.';
        }

        Logger.warn('Login error', { status: edgeStatus, edgeErrorMessage, online: navigator.onLine });
        toast({
          title: "Erro no login",
          description,
          variant: "destructive",
          duration: 4000,
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
      let loginAccess: Access = EMPTY_ACCESS;

      if (data.session?.access_token && data.session?.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });

          try {
            // get_user_roles e get_access (RPC nova, fonte da verdade de
            // experiências+capabilities) em paralelo — mesmo padrão do
            // refreshUserProfile. get_access pode ainda não existir; nesse
            // caso fetchAccessPayload retorna null e caímos no fallback
            // client-side com as roles reais logo abaixo.
            const [rolesResp, accessPayload] = await Promise.all([
              supabase.rpc('get_user_roles', { _user_id: userData.id }),
              authService.fetchAccessPayload(),
            ]);

            const rolesData = rolesResp.data;
            if (rolesData) {
              userData.roles = rolesData;
            }
            loginAccess = accessPayload ?? deriveAccessFromRoles(userData.roles);
          } catch (roleError) {
            Logger.warn('Failed to fetch user roles', roleError);
            userData.roles = [];
            loginAccess = EMPTY_ACCESS;
          }
        } catch (e) {
          userData.roles = [];
          loginAccess = EMPTY_ACCESS;
        }
      } else {
        userData.roles = [];
        loginAccess = EMPTY_ACCESS;
      }

      setUser(userData);
      setRealAccess(loginAccess);
      setNeedsPasswordChange(data.needsPasswordChange || false);

      localStorage.setItem('sanarflix-user', JSON.stringify(userData));
      Logger.info('[Auth] role from DB:', userData.roles);
      Logger.info('login_success', { user_id: userData.id, needsPasswordChange: data.needsPasswordChange || false, roles_count: Array.isArray(userData.roles) ? userData.roles.length : 0 });
      
      broadcast({ type: 'LOGIN', data: userData });
      
      import('../utils/performanceCache').then(({ performanceCache }) => {
        performanceCache.setUserData(userData);
      });
      
      const loginDuration = performance.now() - startTime;
      Logger.performance('login', loginDuration, { user_id: userData.id });
      if (loginDuration > 2000) {
        Logger.warn(`Slow login: ${loginDuration.toFixed(2)}ms`);
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
        Logger.warn('Failed to invalidate sessions:', sessionError);
        
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
        Logger.debug('Supabase signOut failed (safe to ignore):', err);
      }
    });

    setUser(null);
    setRealAccess(EMPTY_ACCESS);
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

  const startImpersonation = useCallback(async (userId: string) => {
    // Checagem de permissão usa SEMPRE o access do usuário REAL (realAccess),
    // nunca o access impersonado — mesmo que uma impersonação já esteja ativa,
    // a capability de impersonar é decidida por quem está de fato logado.
    if (!can(realAccess, 'impersonate')) {
      toast({ title: 'Sem permissão', description: 'Apenas admins podem usar este recurso', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-support', {
        body: { userId, section: 'impersonate' },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      setRealAdminUser(user);
      setImpersonatedUser(data as User);
      setUser(data as User);
      setImpersonatedAccess(deriveAccessFromRoles((data as User).roles));
      isImpersonatingRef.current = true;

      toast({ title: 'Impersonação ativa', description: `Visualizando como ${data.nome}` });
    } catch (err) {
      toast({ title: 'Erro ao impersonar', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    }
  }, [user, realAccess]);

  const stopImpersonation = useCallback(() => {
    if (realAdminUser) {
      const stoppedUser = impersonatedUser;
      setUser(realAdminUser);
      setImpersonatedUser(null);
      setRealAdminUser(null);
      setImpersonatedAccess(null);
      isImpersonatingRef.current = false;
      toast({ title: 'Impersonação encerrada', description: 'Você voltou à sua conta admin' });
      // Auditoria best-effort — não bloqueia a restauração do admin real.
      // A sessão Supabase nunca troca durante impersonação (sempre é a do
      // admin real), então o actor do log já sai correto sem esforço extra.
      if (stoppedUser) {
        logAdminAction('impersonate_stop', stoppedUser.id, { nome: stoppedUser.nome });
      }
    }
  }, [realAdminUser, impersonatedUser]);

  return (
    <AuthContext.Provider value={{
      user: impersonatedUser || user,
      access: impersonatedAccess ?? realAccess,
      login,
      logout,
      isLoading,
      needsPasswordChange,
      changePassword,
      forceRefreshProfile,
      impersonatedUser,
      isImpersonating: !!impersonatedUser,
      realAdminUser,
      startImpersonation,
      stopImpersonation,
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
