import { fetchIa } from '@/features/gestor/lib/fetchIa';
import type { CriterioCoorte } from '@/features/gestor/lib/planoMovimento';


/**
 * Cache de módulo + PRÉ-CARREGAMENTO dos detalhes de movimento.
 *
 * O detalhe de um movimento é uma geração de IA de vários segundos. Esperar o
 * clique da gestora para começar a gerar significa drawer parado enquanto o
 * modelo pensa. Como os movimentos já são conhecidos no instante em que a
 * Leitura estratégica termina, o detalhe de cada um é buscado ali, em segundo
 * plano e em fila (um por vez, para não competir por banda nem por cota), e
 * fica guardado aqui. Quando o clique chega, o drawer abre com tudo pronto.
 *
 * O cache vive no módulo (não em estado de componente) justamente para
 * sobreviver ao ciclo de vida do drawer: fechar e reabrir o mesmo movimento não
 * gera de novo. A chave carrega o recorte inteiro, então trocar de IES,
 * semestre ou seleção de simulados nunca reaproveita detalhe de outro recorte.
 */

export interface PassoPlano {
  acao?: string;
  detalhe?: string;
  responsavel?: string;
  prazo?: string;
  medir?: string;
}

export interface DetalheMovimento {
  diagnostico: string;
  criterioCoorte: CriterioCoorte | null;
  semestreAlvo: number | null;
  alvoAlunos: number | null;
  passos: PassoPlano[];
  risco: string | null;
}

export interface MovimentoParaDetalhar {
  titulo: string;
  metrica?: string;
  texto?: string;
  natureza?: string;
  prioridade?: 'alta' | 'media' | 'baixa';
}

export interface PedidoDetalhe {
  movimento: MovimentoParaDetalhar;
  escopo: 'recorte' | 'institucional';
  iesId: string;
  semestre: string | null;
  simulados: string[];
}

interface Entrada {
  detalhe: DetalheMovimento | null;
  emVoo: Promise<DetalheMovimento> | null;
}

const cache = new Map<string, Entrada>();

/** Chave do recorte + movimento: nunca cruza recortes diferentes. */
export function chaveMovimento(pedido: PedidoDetalhe): string {
  const simulados = pedido.escopo === 'institucional' ? [] : [...pedido.simulados].sort();
  return [pedido.escopo, pedido.iesId, pedido.semestre ?? '', simulados.join(','), pedido.movimento.titulo].join('|');
}

/** Detalhe já pronto, para o drawer abrir sem estado de espera. */
export function detalheEmCache(chave: string): DetalheMovimento | null {
  return cache.get(chave)?.detalhe ?? null;
}

function normalizar(evento: Record<string, unknown>): DetalheMovimento | null {
  if (evento?.tipo === 'erro') throw new Error(String(evento.error ?? 'ai_error'));
  if (typeof evento?.diagnostico !== 'string') return null;
  return {
    diagnostico: evento.diagnostico as string,
    criterioCoorte: (evento.criterioCoorte as CriterioCoorte | null) ?? null,
    semestreAlvo: typeof evento.semestreAlvo === 'number' ? evento.semestreAlvo : null,
    alvoAlunos: typeof evento.alvoAlunos === 'number' ? evento.alvoAlunos : null,
    passos: Array.isArray(evento.passos) ? (evento.passos as PassoPlano[]).slice(0, 5) : [],
    risco: typeof evento.risco === 'string' ? evento.risco : null,
  };
}

async function gerar(
  pedido: PedidoDetalhe,
  opcoes: { refresh?: boolean; onParcial?: (detalhe: DetalheMovimento) => void },
): Promise<DetalheMovimento> {
  const corpo = {
    modo: 'movimento' as const,
    escopo: pedido.escopo,
    iesId: pedido.iesId,
    semestre: pedido.semestre,
    simulados: pedido.escopo === 'institucional' ? null : pedido.simulados,
    movimento: pedido.movimento,
    refresh: opcoes.refresh === true,
  };

  let ultimo: DetalheMovimento | null = null;

  try {
    const resposta = await fetchIa('gestor-ai-insights', { ...corpo, stream: true });

    if (!resposta.ok || !resposta.body) throw new Error('stream_indisponivel');

    const reader = resposta.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const linhas = buffer.split('\n');
      buffer = linhas.pop() ?? '';
      for (const linha of linhas) {
        const trimmed = linha.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        const parcial = normalizar(JSON.parse(payload) as Record<string, unknown>);
        if (parcial) {
          ultimo = parcial;
          opcoes.onParcial?.(parcial);
        }
      }
    }
    if (!ultimo) throw new Error('resposta_invalida');
    return ultimo;
  } catch (erroStream) {
    if (ultimo) return ultimo;
    // Fallback bufferizado: onde o SSE não passa, o detalhe ainda chega.
    const bufferizada = await fetchIa('gestor-ai-insights', corpo);
    if (!bufferizada.ok) throw erroStream instanceof Error ? erroStream : new Error('ai_error');
    const data = (await bufferizada.json()) as Record<string, unknown>;
    const final = normalizar(data ?? {});
    if (!final) throw erroStream instanceof Error ? erroStream : new Error('resposta_invalida');

    return final;
  }
}

/**
 * Detalhe do movimento com deduplicação: uma geração por chave. Um clique que
 * chega no meio do pré-carregamento não dispara segunda chamada — ele espera a
 * que já está no ar. `refresh` (pedido explícito de recarregar) descarta o
 * cache e gera de novo.
 */
export function obterDetalheMovimento(
  pedido: PedidoDetalhe,
  opcoes: { refresh?: boolean; onParcial?: (detalhe: DetalheMovimento) => void } = {},
): Promise<DetalheMovimento> {
  const chave = chaveMovimento(pedido);
  const entrada = cache.get(chave);

  if (!opcoes.refresh) {
    if (entrada?.detalhe) return Promise.resolve(entrada.detalhe);
    if (entrada?.emVoo) return entrada.emVoo;
  }

  const promessa = gerar(pedido, opcoes)
    .then((detalhe) => {
      cache.set(chave, { detalhe, emVoo: null });
      return detalhe;
    })
    .catch((erro) => {
      // Erro não fica em cache: o próximo clique tenta de novo.
      cache.delete(chave);
      throw erro;
    });

  cache.set(chave, { detalhe: opcoes.refresh ? null : (entrada?.detalhe ?? null), emVoo: promessa });
  return promessa;
}

/**
 * Aquece o cache com os movimentos da leitura, em FILA. Sem UI, sem erro
 * visível: se um falhar, o clique da gestora tenta de novo pelo caminho normal.
 */
export function preAquecerMovimentos(
  pedidos: PedidoDetalhe[],
  cancelado?: () => boolean,
): void {
  void pedidos.reduce<Promise<unknown>>(
    (fila, pedido) =>
      fila.then(async () => {
        if (cancelado?.()) return;
        if (detalheEmCache(chaveMovimento(pedido))) return;
        try {
          await obterDetalheMovimento(pedido);
        } catch {
          /* silencioso de propósito: pré-carregamento não fala com a tela */
        }
      }),
    Promise.resolve(),
  );
}
