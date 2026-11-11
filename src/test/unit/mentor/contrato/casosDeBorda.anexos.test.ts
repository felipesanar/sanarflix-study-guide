import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { erroDoArquivo, tipoDoAnexo, useEnviarAnexo } from '@/features/mentor/components/mural-v2/anexoMural';
import { preparar, PUBLICACAO } from './apoio';

const { pedirUpload } = vi.hoisted(() => ({ pedirUpload: vi.fn() }));
vi.mock('@/features/mentor/api/ativa', () => ({ fonteAtiva: () => ({ pedirUpload }) }));

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const arquivo = (bytes: number, type = 'application/pdf', name = 'plano.pdf') => new File([new Uint8Array(bytes)], name, { type });

describe('anexos', () => {
  it('[A2] 10 MB exatos passam', () => {
    expect(erroDoArquivo(arquivo(10 * 1024 * 1024))).toBeNull();
  });
  it('[A2] 10 MB mais um byte nao passam', () => {
    expect(erroDoArquivo(arquivo(10 * 1024 * 1024 + 1))).toEqual(expect.any(String));
  });
  for (const [mime, extensao] of [['application/pdf', 'pdf'], ['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']]) {
    it(`[A2] aceita ${mime}`, () => {
      const f = arquivo(10, mime, `plano.${extensao}`);
      expect(tipoDoAnexo(f)).toBe(mime);
      expect(erroDoArquivo(f)).toBeNull();
    });
    it(`[A2] sem type usa extensao ${extensao}`, () => {
      const f = arquivo(10, '', `PLANO.${extensao.toUpperCase()}`);
      expect(tipoDoAnexo(f)).toBe(mime);
      expect(erroDoArquivo(f)).toBeNull();
    });
  }
  it('[A2] recusa application/zip mesmo com extensao pdf', () => {
    const f = arquivo(10, 'application/zip');
    expect(tipoDoAnexo(f)).toBeNull();
    expect(erroDoArquivo(f)).toEqual(expect.any(String));
  });
  // FALTA: fluxo de envio retorna URL em vez de anexoId da v2.3
  it.fails('[A1] publicacao leva apenas anexoId e nunca url do armazenamento', async () => {
    const a = preparar();
    const upload = a.responder('POST', '/uploads', { nome: 'plano.pdf', mime: 'application/pdf', bytes: 10 });
    const dados = upload.corpo as { arquivoId: string; uploadUrl: string };
    pedirUpload.mockResolvedValue({ ...dados, fileUrl: 'https://arquivos.exemplo.com/plano.pdf' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const { result } = renderHook(() => useEnviarAnexo());
    const anexo = await result.current({ tipo: 'novo', arquivo: arquivo(10), nome: 'plano.pdf' });
    // Espelha a composicao atual do composer, sem inventar um conversor no teste.
    await a.fonte.criarPublicacao(a.triboId, { ...PUBLICACAO, anexo }).catch(() => undefined);
    expect(a.pedidos[0].corpo).toMatchObject({ anexoId: dados.arquivoId });
    expect(a.pedidos[0].corpo).not.toHaveProperty('anexo');
  });
  // FALTA: PUT de anexo nao tem cancelamento nem tempo limite de dois minutos
  it.fails('[A5] envio pendurado e abortado em ate dois minutos sem publicar', async () => {
    vi.useFakeTimers();
    pedirUpload.mockResolvedValue({ uploadUrl: 'https://upload.exemplo.com/plano', fileUrl: 'https://arquivos.exemplo.com/plano.pdf' });
    let sinal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url, opcoes: RequestInit) => {
      sinal = opcoes.signal ?? undefined;
      return new Promise((_resolve, reject) => sinal?.addEventListener('abort', () => reject(new Error('Tempo limite'))));
    }));
    const { result } = renderHook(() => useEnviarAnexo());
    let terminou = false;
    const envio = result.current({ tipo: 'novo', arquivo: arquivo(10), nome: 'plano.pdf' });
    void envio.then(() => { terminou = true; }, () => { terminou = true; });
    await vi.advanceTimersByTimeAsync(120001);
    expect(sinal?.aborted).toBe(true);
    expect(terminou).toBe(true);
  });
});
