/**
 * Camada de serviço para administração de usuários (B2B/B2C).
 *
 * Encapsula as edge functions sensíveis (b2b-create-user, delete-user,
 * sync-user-auth, request-password-reset) para que admin components
 * deixem de chamar supabase.functions.invoke diretamente.
 *
 * Cada função aqui já tem CORS allowlist + rate limit + Zod no server
 * (ver Fase 2 do plano). Este service apenas tipa e centraliza o consumo.
 */
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

export interface CreateUserPayload {
  email: string;
  nome: string;
  id_ies: string;
  semestre?: number | null;
  role?: 'aluno' | 'professor' | 'admin' | 'gestor' | 'gestor_grupo' | 'atendimento';
}

export interface CreateUserResult {
  success: boolean;
  action?: 'created' | 'updated';
  userId?: string;
  email?: string;
  message?: string;
  /** Detalhes adicionais retornados pela edge function. */
  details?: {
    emailSent?: boolean;
    fieldsUpdated?: string[];
  };
  error?: string;
  code?: string;
}

export interface DeleteUsersPayload {
  user_id?: string;
  user_ids?: string[];
  ies_id?: string;
  semestre?: number | string;
  resolve_only?: boolean;
  cursor?: number;
  page_size?: number;
}

export interface DeleteUsersResult {
  success: boolean;
  user_ids?: string[];
  has_more?: boolean;
  next_cursor?: number | null;
  results?: {
    deleted: string[];
    failed: Array<{ id: string; nome: string; email: string; error: string }>;
  };
  error?: string;
}

export const usersService = {
  /**
   * Cria (ou recupera) um usuário B2B. Idempotente: se o email já existe
   * em auth mas não em public.users, recupera e sincroniza.
   */
  async createUser(payload: CreateUserPayload): Promise<CreateUserResult> {
    const { data, error } = await supabase.functions.invoke('b2b-create-user', {
      body: payload,
    });

    if (error) {
      // Supabase wraps HTTP errors em FunctionsHttpError com .context. Tenta
      // extrair o body JSON estruturado antes de cair no fallback genérico.
      let extractedError: string | undefined;
      let extractedCode: string | undefined;
      let extractedDetails: string | undefined;
      try {
        const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
        const body = (await ctx?.json?.()) as
          | { error?: string; code?: string; details?: string }
          | undefined;
        extractedError = body?.error;
        extractedCode = body?.code;
        extractedDetails = body?.details;
      } catch {
        // Body não-JSON ou indisponível — usa fallback.
      }
      Logger.error('[usersService.createUser] edge fn error', error);
      return {
        success: false,
        error: extractedError ?? 'Falha ao criar usuário',
        code: extractedCode,
        message: extractedDetails,
      };
    }

    return data as CreateUserResult;
  },

  /**
   * Deleta um único usuário (com todas as suas dependências).
   * Bloqueia auto-delete server-side.
   */
  async deleteOne(userId: string): Promise<DeleteUsersResult> {
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { user_id: userId },
    });
    if (error) {
      Logger.error('[usersService.deleteOne] edge fn error', error);
      return { success: false, error: 'Falha ao remover usuário' };
    }
    return data as DeleteUsersResult;
  },

  /**
   * Batch delete (até MAX_BATCH_SIZE no server). Use junto com
   * `resolveIesUsers` para paginar IES inteiras.
   */
  async deleteBatch(userIds: string[]): Promise<DeleteUsersResult> {
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { user_ids: userIds },
    });
    if (error) {
      Logger.error('[usersService.deleteBatch] edge fn error', error);
      return { success: false, error: 'Falha no batch delete' };
    }
    return data as DeleteUsersResult;
  },

  /**
   * Resolve IDs de usuários de uma IES (paginado). Use para iterar
   * antes de chamar deleteBatch.
   */
  async resolveIesUsers(
    iesId: string,
    opts: { semestre?: number; cursor?: number; pageSize?: number } = {}
  ): Promise<DeleteUsersResult> {
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: {
        ies_id: iesId,
        resolve_only: true,
        semestre: opts.semestre,
        cursor: opts.cursor ?? 0,
        page_size: opts.pageSize ?? 500,
      },
    });
    if (error) {
      Logger.error('[usersService.resolveIesUsers] edge fn error', error);
      return { success: false, error: 'Falha ao listar usuários da IES' };
    }
    return data as DeleteUsersResult;
  },

  /**
   * Sincroniza um usuário entre auth.users e public.users (corrige drift).
   */
  async syncAuth(email: string): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke('sync-user-auth', {
      body: { email },
    });
    if (error || data?.error) {
      Logger.error('[usersService.syncAuth]', error || data?.error);
      return { ok: false, error: data?.error || 'Falha ao sincronizar' };
    }
    return { ok: true };
  },

  /**
   * Inicia o fluxo de reset de senha (server envia email via Novu).
   * Sempre retorna sucesso silencioso, mesmo se o email não existir
   * (anti-enumeração — comportamento server-side).
   */
  async requestPasswordReset(email: string): Promise<{ ok: boolean }> {
    const { data, error } = await supabase.functions.invoke('request-password-reset', {
      body: { email },
    });
    if (error) {
      Logger.error('[usersService.requestPasswordReset]', error);
      return { ok: false };
    }
    return { ok: !!data?.success };
  },
};
