/**
 * Testes do authService (Fase 3 do plano).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/services/authService';

describe('services/authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserRoles', () => {
    it('retorna roles do RPC quando bem-sucedido', async () => {
      (supabase.rpc as any) = vi.fn().mockResolvedValue({ data: ['admin', 'aluno'], error: null });

      const roles = await authService.getUserRoles('u1');
      expect(roles).toEqual(['admin', 'aluno']);
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_roles', { _user_id: 'u1' });
    });

    it('retorna [] em caso de erro do RPC (defesa: sem privilégio por padrão)', async () => {
      (supabase.rpc as any) = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });

      const roles = await authService.getUserRoles('u1');
      expect(roles).toEqual([]);
    });
  });

  describe('changePassword', () => {
    it('retorna ok=true em sucesso', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({ data: { ok: true }, error: null });
      const result = await authService.changePassword('u1', 'Abc123!Def');
      expect(result.ok).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('update-password', {
        body: { userId: 'u1', newPassword: 'Abc123!Def' },
      });
    });

    it('retorna ok=false com erro estruturado quando edge fn falha', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { error: 'senha fraca' },
        error: null,
      });
      const result = await authService.changePassword('u1', 'fraca');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('senha fraca');
    });
  });

  describe('startImpersonation', () => {
    it('chama edge fn admin-user-support com section=impersonate', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({ data: { ok: true }, error: null });
      const result = await authService.startImpersonation('target-user');
      expect(result.ok).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-user-support', {
        body: { userId: 'target-user', section: 'impersonate' },
      });
    });

    it('retorna erro quando server rejeita (rate limit, sem privilégio, etc.)', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { error: 'forbidden' },
        error: null,
      });
      const result = await authService.startImpersonation('target-user');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('forbidden');
    });
  });

  describe('invalidateSessions', () => {
    it('é best-effort: não lança mesmo se a edge fn falhar', async () => {
      (supabase.functions.invoke as any).mockRejectedValue(new Error('network'));
      // Não deve lançar
      await expect(authService.invalidateSessions('u1')).resolves.toBeUndefined();
    });
  });
});
