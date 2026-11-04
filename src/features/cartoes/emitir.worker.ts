/// <reference lib="webworker" />
/**
 * Worker que monta o PDF dos cartões fora da thread da tela: turmas grandes (700 cartões levam ~25 s) não
 * travam a página e não sofrem a limitação de temporizadores das abas em segundo plano.
 */
import { gerarPdf } from './emitir.ts';
import { TEMPLATES } from './templates.ts';
import type { CardSpec, LayoutCartao } from './types.ts';

export interface PedidoWorker {
  layout: LayoutCartao;
  specs: CardSpec[];
  titulo: string;
}

export type RespostaWorker =
  | { tipo: 'progresso'; feitas: number; total: number }
  | { tipo: 'pronto'; buffer: ArrayBuffer }
  | { tipo: 'erro'; mensagem: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (ev: MessageEvent<PedidoWorker>) => {
  const { layout, specs, titulo } = ev.data;
  try {
    const buffer = await gerarPdf(
      TEMPLATES[layout],
      specs,
      { ceder: 0, onProgress: (p) => ctx.postMessage({ tipo: 'progresso', ...p } satisfies RespostaWorker) },
      titulo,
    );
    ctx.postMessage({ tipo: 'pronto', buffer } satisfies RespostaWorker, [buffer]);
  } catch (err) {
    ctx.postMessage({ tipo: 'erro', mensagem: err instanceof Error ? err.message : String(err) } satisfies RespostaWorker);
  }
};
