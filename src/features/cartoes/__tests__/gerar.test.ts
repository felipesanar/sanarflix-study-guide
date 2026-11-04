import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmissaoCancelada, montarSpecs } from '../emitir.ts';
import { gerarPdfSegundoPlano } from '../gerar.ts';

const SIM = '9d6c1f0e-0a5b-4c3a-8d2e-123456789abc';
const ALUNOS = [
  { matricula: '2023001234', nome: 'Maria Exemplo da Silva' },
  { matricula: '2023001235', nome: 'Ana Teste' },
];
const specs = () => montarSpecs({ layout: 'sfa', simuladoId: SIM, ies: 'IES', alunos: ALUNOS });

afterEach(() => vi.unstubAllGlobals());

describe('gerarPdfSegundoPlano sem Worker (fallback na thread principal)', () => {
  it('gera o PDF e informa o progresso', async () => {
    const progresso = vi.fn();
    const buf = await gerarPdfSegundoPlano('sfa', specs(), { onProgress: progresso });
    expect(new TextDecoder('latin1').decode(new Uint8Array(buf).slice(0, 5))).toBe('%PDF-');
    expect(progresso).toHaveBeenLastCalledWith({ feitas: 2, total: 2 });
  });

  it('cancela com AbortController', async () => {
    const controle = new AbortController();
    const promessa = gerarPdfSegundoPlano('sfa', specs(), { signal: controle.signal, onProgress: () => controle.abort() });
    await expect(promessa).rejects.toBeInstanceOf(EmissaoCancelada);
  });
});

/** Worker de mentira: guarda as mensagens e deixa o teste responder como o worker real responderia. */
class FakeWorker {
  static ultimo: FakeWorker | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  enviadas: unknown[] = [];
  terminado = false;
  url: URL;
  constructor(url: URL, public opcoes?: WorkerOptions) {
    this.url = url;
    FakeWorker.ultimo = this;
  }
  postMessage(msg: unknown): void {
    this.enviadas.push(msg);
  }
  terminate(): void {
    this.terminado = true;
  }
  responder(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('gerarPdfSegundoPlano com Worker', () => {
  it('manda o pedido ao worker, repassa o progresso e devolve o PDF', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const progresso = vi.fn();
    const s = specs();
    const promessa = gerarPdfSegundoPlano('sfa', s, { onProgress: progresso }, 'Título');
    const w = FakeWorker.ultimo!;
    expect(w.url.pathname.endsWith('emitir.worker.ts')).toBe(true);
    expect(w.opcoes).toEqual({ type: 'module' });
    expect(w.enviadas).toEqual([{ layout: 'sfa', specs: s, titulo: 'Título' }]);
    w.responder({ tipo: 'progresso', feitas: 1, total: 2 });
    const buffer = new ArrayBuffer(8);
    w.responder({ tipo: 'pronto', buffer });
    await expect(promessa).resolves.toBe(buffer);
    expect(progresso).toHaveBeenCalledWith({ feitas: 1, total: 2 });
    expect(w.terminado).toBe(true);
  });

  it('rejeita com a mensagem de erro do worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const promessa = gerarPdfSegundoPlano('sfa', specs());
    FakeWorker.ultimo!.responder({ tipo: 'erro', mensagem: 'sem memória' });
    await expect(promessa).rejects.toThrow('sem memória');
    expect(FakeWorker.ultimo!.terminado).toBe(true);
  });

  it('rejeita se o worker falhar ao carregar', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const promessa = gerarPdfSegundoPlano('sfa', specs());
    FakeWorker.ultimo!.onerror?.({ message: 'módulo não encontrado' } as ErrorEvent);
    await expect(promessa).rejects.toThrow('módulo não encontrado');
  });

  it('abortar encerra o worker na hora e rejeita como cancelamento', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const controle = new AbortController();
    const promessa = gerarPdfSegundoPlano('sfa', specs(), { signal: controle.signal });
    controle.abort();
    await expect(promessa).rejects.toBeInstanceOf(EmissaoCancelada);
    expect(FakeWorker.ultimo!.terminado).toBe(true);
  });

  it('já abortado: nem cria o worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.ultimo = null;
    const controle = new AbortController();
    controle.abort();
    await expect(gerarPdfSegundoPlano('sfa', specs(), { signal: controle.signal })).rejects.toBeInstanceOf(EmissaoCancelada);
    expect(FakeWorker.ultimo).toBeNull();
  });
});
