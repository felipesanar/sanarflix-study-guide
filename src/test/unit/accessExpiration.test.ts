/**
 * Acessos temporários — helpers de data da validade (dia escolhido pelo admin
 * ↔ instante em que o acesso termina) e contrato do payload do usersService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dateToExpiraEmISO,
  expiraEmISOToDate,
  formatExpiraEm,
  todayBrazilDateString,
} from '@/utils/timezone';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
import { supabase } from '@/integrations/supabase/client';
import { usersService } from '@/services/usersService';

describe('validade de acesso — helpers de data', () => {
  it('o dia escolhido vale até o fim do dia em Brasília (00:00 -03:00 do dia seguinte)', () => {
    expect(dateToExpiraEmISO('2026-11-30')).toBe('2026-12-01T03:00:00.000Z');
  });

  it('virada de mês e de ano', () => {
    expect(dateToExpiraEmISO('2026-12-31')).toBe('2027-01-01T03:00:00.000Z');
    expect(dateToExpiraEmISO('2028-02-28')).toBe('2028-02-29T03:00:00.000Z'); // bissexto
  });

  it('vazio vira vazio', () => {
    expect(dateToExpiraEmISO('')).toBe('');
    expect(expiraEmISOToDate('')).toBe('');
    expect(formatExpiraEm('')).toBe('');
  });

  it('ida e volta preserva o dia escolhido', () => {
    for (const d of ['2026-11-17', '2026-12-31', '2027-03-01']) {
      expect(expiraEmISOToDate(dateToExpiraEmISO(d))).toBe(d);
    }
  });

  it('formata o último dia de acesso como dd/MM/yyyy', () => {
    expect(formatExpiraEm('2026-12-01T03:00:00.000Z')).toBe('30/11/2026');
  });

  it('todayBrazilDateString usa o relógio de Brasília, não o UTC', () => {
    // 02:00 UTC de 18/11 ainda é 23:00 de 17/11 em Brasília
    expect(todayBrazilDateString(new Date('2026-11-18T02:00:00Z'))).toBe('2026-11-17');
    expect(todayBrazilDateString(new Date('2026-11-18T03:00:00Z'))).toBe('2026-11-18');
  });
});

describe('usersService.createUser — validade opcional', () => {
  beforeEach(() => {
    vi.mocked(supabase.functions.invoke).mockReset();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { success: true }, error: null } as never);
  });

  const base = { email: 'a@b.com', nome: 'Fulano de Tal', id_ies: 'ies-1' };

  it('sem validade: o campo não vai no payload (acesso permanente / não alterar)', async () => {
    await usersService.createUser(base);
    const body = vi.mocked(supabase.functions.invoke).mock.calls[0][1]?.body as Record<string, unknown>;
    expect('acesso_expira_em' in body).toBe(false);
  });

  it('com validade: repassa o ISO para a edge function', async () => {
    await usersService.createUser({ ...base, acesso_expira_em: '2026-12-01T03:00:00.000Z' });
    const body = vi.mocked(supabase.functions.invoke).mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body.acesso_expira_em).toBe('2026-12-01T03:00:00.000Z');
  });

  it('null explícito é preservado (tornar permanente)', async () => {
    await usersService.createUser({ ...base, acesso_expira_em: null });
    const body = vi.mocked(supabase.functions.invoke).mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body.acesso_expira_em).toBeNull();
  });
});
