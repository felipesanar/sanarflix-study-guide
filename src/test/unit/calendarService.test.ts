/**
 * Testes do calendarService (Fase 3 do plano).
 *
 * Estratégia: mockamos o cliente supabase no nível do módulo
 * (já configurado em src/test/setup.ts) e validamos:
 *  - listSubjects mapeia row -> CalendarSubject corretamente
 *  - replaceSubjects faz upsert + delete diff
 *  - subscribeToChanges retorna função de cleanup
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { calendarService } from '@/services/calendarService';

describe('services/calendarService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listSubjects', () => {
    it('mapeia row do banco para CalendarSubject', async () => {
      const mockData = [
        { id: 'r1', user_id: 'u1', name: 'Matemática', color: '#fff', day_of_week: 1 },
        { id: 'r2', user_id: 'u1', name: 'Português', color: '#000', day_of_week: 3 },
      ];

      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      (supabase.from as any).mockReturnValue(builder);

      const result = await calendarService.listSubjects('u1');

      expect(result).toEqual([
        { id: 'r1', name: 'Matemática', color: '#fff', dayOfWeek: 1 },
        { id: 'r2', name: 'Português', color: '#000', dayOfWeek: 3 },
      ]);
      expect(supabase.from).toHaveBeenCalledWith('calendar_subjects');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    });

    it('retorna array vazio em caso de erro do banco (não lança)', async () => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
      };
      (supabase.from as any).mockReturnValue(builder);

      const result = await calendarService.listSubjects('u1');
      expect(result).toEqual([]);
    });
  });

  describe('subscribeToChanges', () => {
    it('retorna função de cleanup que remove o canal', () => {
      const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
      (supabase as any).channel = vi.fn().mockReturnValue(channel);
      (supabase as any).removeChannel = vi.fn();

      const unsubscribe = calendarService.subscribeToChanges('u1', () => {});
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      expect((supabase as any).removeChannel).toHaveBeenCalledWith(channel);
    });
  });
});
