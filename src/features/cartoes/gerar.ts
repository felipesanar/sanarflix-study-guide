/**
 * Ponto de entrada da tela: gera o PDF num Web Worker; sem Worker (testes, navegadores antigos), na thread
 * principal. Cancelar = `AbortController.abort()` (o worker é encerrado na hora).
 */
import { EmissaoCancelada, gerarPdf } from './emitir.ts';
import type { ProgressoEmissao } from './emitir.ts';
import type { RespostaWorker } from './emitir.worker.ts';
import { TEMPLATES } from './templates.ts';
import type { CardSpec, LayoutCartao } from './types.ts';

export interface OpcoesGeracao {
  onProgress?: (p: ProgressoEmissao) => void;
  signal?: AbortSignal;
}

export function gerarPdfSegundoPlano(
  layout: LayoutCartao,
  specs: CardSpec[],
  opcoes: OpcoesGeracao = {},
  titulo = 'Cartões-resposta SFA',
): Promise<ArrayBuffer> {
  if (typeof Worker === 'undefined') {
    const opts = { ceder: 4, shouldCancel: () => opcoes.signal?.aborted === true };
    return gerarPdf(TEMPLATES[layout], specs, { ...opts, ...(opcoes.onProgress ? { onProgress: opcoes.onProgress } : {}) }, titulo);
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    if (opcoes.signal?.aborted) return reject(new EmissaoCancelada());
    const worker = new Worker(new URL('./emitir.worker.ts', import.meta.url), { type: 'module' });
    const encerrar = (): void => {
      opcoes.signal?.removeEventListener('abort', aoCancelar);
      worker.terminate();
    };
    const aoCancelar = (): void => {
      encerrar();
      reject(new EmissaoCancelada());
    };
    opcoes.signal?.addEventListener('abort', aoCancelar, { once: true });
    worker.onmessage = (ev: MessageEvent<RespostaWorker>) => {
      const msg = ev.data;
      if (msg.tipo === 'progresso') {
        opcoes.onProgress?.({ feitas: msg.feitas, total: msg.total });
      } else if (msg.tipo === 'pronto') {
        encerrar();
        resolve(msg.buffer);
      } else {
        encerrar();
        reject(new Error(msg.mensagem));
      }
    };
    worker.onerror = (ev: ErrorEvent) => {
      encerrar();
      reject(new Error(ev.message || 'falha no worker de emissão'));
    };
    worker.postMessage({ layout, specs, titulo });
  });
}
