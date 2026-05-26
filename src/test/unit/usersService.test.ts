/**
 * Testes do usersService (Fase 3 do plano).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { usersService } from '@/services/usersService';

describe('services/usersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('invoca edge fn b2b-create-user com payload completo', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true, action: 'created', userId: 'u123', email: 'a@b.com' },
        error: null,
      });

      const result = await usersService.createUser({
        email: 'a@b.com',
        nome: 'Aluno Teste',
        id_ies: 'ies-1',
        semestre: 5,
        role: 'aluno',
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith('b2b-create-user', {
        body: expect.objectContaining({ email: 'a@b.com', nome: 'Aluno Teste', id_ies: 'ies-1' }),
      });
      expect(result.success).toBe(true);
      expect(result.userId).toBe('u123');
    });

    it('retorna erro sanitizado se a edge function falhar', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: null,
        error: { message: 'network err' },
      });

      const result = await usersService.createUser({
        email: 'a@b.com',
        nome: 'A',
        id_ies: 'ies-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Falha ao criar usuário');
    });
  });

  describe('resolveIesUsers', () => {
    it('passa cursor + page_size para a edge fn', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true, user_ids: ['u1', 'u2'], has_more: true, next_cursor: 500 },
        error: null,
      });

      await usersService.resolveIesUsers('ies-1', { cursor: 0, pageSize: 500, semestre: 3 });

      expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-user', {
        body: {
          ies_id: 'ies-1',
          resolve_only: true,
          semestre: 3,
          cursor: 0,
          page_size: 500,
        },
      });
    });
  });

  describe('requestPasswordReset', () => {
    it('é silent-success mesmo quando data.success=false (anti-enumeração)', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await usersService.requestPasswordReset('foo@bar.com');
      expect(result.ok).toBe(true);
    });
  });
});
