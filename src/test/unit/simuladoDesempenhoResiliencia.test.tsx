import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(() => cleanup());

const rpcImpl = vi.fn();
const { mockAuth } = vi.hoisted(() => ({ mockAuth: { user: { id: 'u1' } } }));
// = { user: { id: 'u1' } };
vi.mock('@/integrations/supabase/client', () => {
  const single = (p: Promise<any>) => ({ single: () => p, then: (a: any, b: any) => p.then(a, b) });
  return {
    supabase: {
      rpc: (name: string, args?: any) => single(rpcImpl(name, args)),
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { semestre: 9 }, error: null }) }) }) }),
    },
  };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mockAuth }));

import { SimuladoDesempenho } from '@/pages/SimuladoDesempenho';
import { TooltipProvider } from '@/components/ui/tooltip';

const agg = { data: { overallStats: { total: 100, acertos: 70 }, byArea: [], bySpecialty: [], bySubspecialty: [] }, error: null };

describe('Desempenho do aluno', () => {
  it('mostra resultados mesmo quando o ranking falha', async () => {
    sessionStorage.clear();
    rpcImpl.mockImplementation((n: string) => {
      if (n === 'get_user_simulados') return Promise.resolve({ data: [{ id: 's1', nome: 'Sim 1' }], error: null });
      if (n === 'get_user_performance_aggregates') return Promise.resolve(agg);
      if (n === 'get_user_rankings') return Promise.resolve({ data: null, error: { message: 'timeout' } });
      return Promise.resolve({ data: [], error: null });
    });
    render(<TooltipProvider><SimuladoDesempenho /></TooltipProvider>);
    expect(await screen.findByText('Dashboard de Desempenho')).toBeTruthy();
  });

  it('mostra erro com tentar novamente (não "Nenhum dado") quando os totais falham', async () => {
    sessionStorage.clear();
    rpcImpl.mockImplementation((n: string) => {
      if (n === 'get_user_performance_aggregates') return Promise.resolve({ data: null, error: { message: 'x' } });
      return Promise.resolve({ data: [], error: null });
    });
    render(<TooltipProvider><SimuladoDesempenho /></TooltipProvider>);
    expect(await screen.findByText('Não foi possível carregar seu desempenho')).toBeTruthy();
    expect(screen.queryByText('Nenhum dado de simulado')).toBeNull();
  });
});
