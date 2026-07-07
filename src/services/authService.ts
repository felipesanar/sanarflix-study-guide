/**
 * Camada de serviço para autenticação, identidade e impersonation.
 *
 * Encapsula RPCs e edge functions ligadas a auth. Componentes/contextos
 * devem consumir este service em vez de chamar supabase diretamente.
 *
 * Migração: AuthContext.tsx ainda chama supabase em vários lugares por
 * razões históricas; novas features devem usar authService. A migração
 * incremental do AuthContext fica para PR dedicado (alto impacto).
 */
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';
import { Access, deriveAccessFromRoles, parseAccessPayload } from '@/experiences/access';

export type UserRole = 'admin' | 'professor' | 'gestor' | 'gestor_grupo' | 'atendimento' | 'aluno' | 'guest' | string;

export interface AuthLoginPayload {
  email: string;
  password: string;
}

export interface AuthLoginResult {
  success: boolean;
  needsPasswordChange?: boolean;
  error?: string;
}

export const authService = {
  /**
   * Lista as roles do usuário consultando a RPC `get_user_roles` (server-side).
   * Returns [] em caso de erro — chamadores devem tratar como sem privilégio.
   */
  async getUserRoles(userId: string): Promise<UserRole[]> {
    const { data, error } = await supabase.rpc('get_user_roles', { _user_id: userId });
    if (error) {
      Logger.error('[authService.getUserRoles]', error);
      return [];
    }
    return (data ?? []) as UserRole[];
  },

  /**
   * Busca o payload cru da RPC `get_access` (fonte da verdade no banco,
   * SECURITY DEFINER, sem args — usa auth.uid()) e valida com
   * `parseAccessPayload`. Retorna `null` se a RPC falhar, ainda não existir,
   * ou devolver um payload malformado — o caller deve tratar `null` com
   * `deriveAccessFromRoles(roles)` como fallback.
   *
   * A RPC pode ainda não existir nos types gerados do Supabase; chamamos com
   * cast até o schema ser regenerado.
   */
  async fetchAccessPayload(): Promise<Access | null> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_access');
      if (error) {
        Logger.warn('[authService.fetchAccessPayload] RPC error', error);
        return null;
      }
      const parsed = parseAccessPayload(data);
      if (!parsed) {
        Logger.warn('[authService.fetchAccessPayload] payload inválido', data);
      }
      return parsed;
    } catch (e) {
      Logger.warn('[authService.fetchAccessPayload] exceção inesperada', e);
      return null;
    }
  },

  /**
   * Acesso por experiências + capabilities, com fallback client-side.
   * Conveniência sobre `fetchAccessPayload` para callers que já têm as
   * roles do usuário disponíveis (login, refresh síncrono simples).
   */
  async getAccess(fallbackRoles: string[] | undefined | null): Promise<Access> {
    const parsed = await this.fetchAccessPayload();
    return parsed ?? deriveAccessFromRoles(fallbackRoles);
  },

  /**
   * IES acessíveis ao usuário (admin pode ter múltiplas; aluno típico tem 1).
   */
  async getAccessibleIes(userId: string): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_accessible_ies', { _user: userId });
    if (error) {
      Logger.error('[authService.getAccessibleIes]', error);
      return [];
    }
    return (data ?? []) as string[];
  },

  /**
   * Login via edge function dedicada (não usa supabase.auth.signInWithPassword
   * diretamente — a edge function aplica regras de negócio adicionais).
   */
  async login(payload: AuthLoginPayload): Promise<AuthLoginResult> {
    const { data, error } = await supabase.functions.invoke('auth-login', {
      body: payload,
    });
    if (error) {
      Logger.error('[authService.login] edge fn error', error);
      return { success: false, error: 'Falha ao autenticar' };
    }
    return {
      success: !!data?.success,
      needsPasswordChange: !!data?.needsPasswordChange,
      error: data?.error,
    };
  },

  /**
   * Troca de senha do usuário autenticado.
   */
  async changePassword(userId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke('update-password', {
      body: { userId, newPassword },
    });
    if (error || data?.error) {
      const detail = data?.error || error?.message || 'Erro interno';
      Logger.error('[authService.changePassword]', detail);
      return { ok: false, error: detail };
    }
    return { ok: true };
  },

  /**
   * Invalida todas as sessões do usuário (após troca de senha, por exemplo).
   */
  async invalidateSessions(userId: string): Promise<void> {
    try {
      await supabase.functions.invoke('session-security', {
        body: { action: 'invalidate_sessions', userId },
      });
    } catch (e) {
      // Best-effort — não bloqueia o caller.
      Logger.warn('[authService.invalidateSessions] best-effort failed', e);
    }
  },

  /**
   * Inicia impersonation. Servidor (edge fn admin-user-support) revalida
   * que o caller é admin — defesa em profundidade contra bypass client-side.
   */
  async startImpersonation(targetUserId: string): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke('admin-user-support', {
      body: { userId: targetUserId, section: 'impersonate' },
    });
    if (error || data?.error) {
      Logger.error('[authService.startImpersonation]', error || data?.error);
      return { ok: false, error: data?.error || 'Falha ao iniciar impersonation' };
    }
    return { ok: true };
  },

  /**
   * Aplica uma sessão (access_token + refresh_token) recebida da edge fn.
   * Wrapper sobre supabase.auth.setSession para facilitar testes.
   */
  async setSession(accessToken: string, refreshToken: string): Promise<void> {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  },

  /**
   * Refresh imperativo da sessão atual.
   */
  async refreshSession(): Promise<void> {
    await supabase.auth.refreshSession();
  },

  /**
   * Sign out global.
   */
  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      Logger.warn('[authService.signOut]', e);
    }
  },
};
