/**
 * Diagnóstico da IA: hook local (`useDiagnosticoIa`) e o contrato da Edge `mentor-ai-insights`
 * (lido do fonte: a Edge roda em Deno e não entra no vitest).
 */
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { _definirConfigParaTestes } from '@/features/mentor/api/ativa';
import { mensagemErro } from '@/features/mentor/api/erros';
import { useDiagnosticoIa } from '../useDiagnosticoIa';

const fetchIa = vi.hoisted(() => vi.fn());
vi.mock('@/features/gestor/lib/fetchIa', () => ({ fetchIa }));

const resposta = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo }) as Response;
function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

afterEach(() => { fetchIa.mockReset(); _definirConfigParaTestes(null); });

describe('useDiagnosticoIa', () => {
  it('lê do servidor (com cache) e "Gerar de novo" manda refresh: true', async () => {
    _definirConfigParaTestes({ fonte: 'academy' });
    fetchIa
      .mockResolvedValueOnce(resposta(200, { resumo: 'R1', itens: [{ destaque: 'D', texto: 'T' }], geradoEm: '2026-09-21T10:00:00Z', cached: true }))
      .mockResolvedValueOnce(resposta(200, { resumo: 'R2', itens: [], geradoEm: '2026-09-22T10:00:00Z' }));
    const { result } = renderHook(() => useDiagnosticoIa('b2c', ['s5', 's4']), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.resumo).toBe('R1'));
    expect(fetchIa).toHaveBeenLastCalledWith('mentor-ai-insights', { modalidade: 'b2c', simulados: ['s5', 's4'], refresh: false });
    await act(async () => { await result.current.gerarDeNovo(); });
    expect(fetchIa).toHaveBeenLastCalledWith('mentor-ai-insights', { modalidade: 'b2c', simulados: ['s5', 's4'], refresh: true });
    await waitFor(() => expect(result.current.data?.resumo).toBe('R2'));
  });

  it('erro 5xx vira ErroFonte de rede (mensagem pronta para a UI)', async () => {
    _definirConfigParaTestes({ fonte: 'academy' });
    fetchIa.mockResolvedValue(resposta(500, { error: 'AI error' }));
    const { result } = renderHook(() => useDiagnosticoIa('b2b', ['s4']), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.erro).toBeTruthy());
    expect(mensagemErro(result.current.erro)).toBe('Não foi possível carregar agora. Tente novamente.');
  });

  it('sem simulado não chama a Edge', () => {
    _definirConfigParaTestes({ fonte: 'academy' });
    renderHook(() => useDiagnosticoIa('b2c', []), { wrapper: wrapper() });
    expect(fetchIa).not.toHaveBeenCalled();
  });
});

describe('Edge mentor-ai-insights (contrato)', () => {
  const raiz = resolve(__dirname, '../../../../../..');
  const src = readFileSync(resolve(raiz, 'supabase/functions/mentor-ai-insights/index.ts'), 'utf-8');
  const config = readFileSync(resolve(raiz, 'supabase/config.toml'), 'utf-8');

  it('reaproveita _shared/ai.ts e _shared/enamed.ts', () => {
    expect(src).toMatch(/from "\.\.\/_shared\/ai\.ts"/);
    expect(src).toMatch(/from "\.\.\/_shared\/enamed\.ts"/);
  });

  it('lê as RPCs do mentor com o client do usuário (JWT), nunca com service role', () => {
    expect(src).toMatch(/supabaseUser\.rpc\("mentor_detalhamento"/);
    expect(src).toMatch(/supabaseUser\.rpc\("mentor_detalhamento_b2b"/);
    expect(src).not.toMatch(/supabaseAdmin\.rpc\(/);
    expect(src).toMatch(/global: \{ headers: \{ Authorization: authHeader \} \}/);
  });

  it('cache em ai_response_cache com chave modo + recorte; refresh ignora o cache', () => {
    expect(src).toMatch(/hashChave\(\["mentor-ai-insights", "v1", modalidade, userData\.user\.id, \[\.\.\.simulados\]\.sort\(\)\]\)/);
    expect(src).toMatch(/if \(!refresh\) \{\s*const cached = await lerCache/);
    expect(src).toMatch(/gravarCache\(supabaseAdmin/);
  });

  it('config.toml exige JWT', () => {
    expect(config).toMatch(/\[functions\.mentor-ai-insights\]\s*\nverify_jwt = true/);
  });
});
