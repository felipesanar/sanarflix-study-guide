import * as React from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { env } from '@/config/env';

import { Icon } from '@/features/gestor/components/Icon';
import { DrawerMovimento, type MovimentoSelecionado } from '@/features/gestor/components/DrawerMovimento';

/**
 * "Leitura estratégica" do recorte de simulados — persona de consultoria
 * sênior em ENAMED (mesma anatomia visual do mentor da experiência do aluno:
 * cabeçalho com identidade + bolha de conteúdo + rodapé de procedência), mas
 * com pegada de dashboard: uma frase de diagnóstico e até 3 movimentos
 * priorizados, cada um com o número que o sustenta.
 *
 * A procedência NUNCA é rotulada como análise automática — a superfície fala
 * como consultor, e o texto vem do backend (`gestor-ai-insights`,
 * `modo: 'consultor'`), que lê o MESMO recorte da tela via
 * `get_gestor_detalhamento`. Nenhum número é calculado aqui.
 */

interface ItemLeitura {
  titulo: string;
  metrica: string;
  texto: string;
  prioridade?: 'alta' | 'media' | 'baixa';
}

interface Leitura {
  leitura: string;
  itens: ItemLeitura[];
}

type Estado = 'idle' | 'loading' | 'sucesso' | 'erro';

/**
 * Escopo da leitura, decidido pela TELA que monta o componente:
 * - `recorte` (Detalhamento): a leitura responde aos simulados selecionados;
 * - `institucional` (Visão Geral): a leitura responde na escala do curso, sem
 *   recorte de simulado — é a pergunta daquela página.
 * O backend recebe o escopo e troca de contexto e de prompt; nenhuma das duas
 * leituras é calculada aqui.
 */
export type EscopoLeitura = 'recorte' | 'institucional';


const COR_PRIORIDADE: Record<string, string> = {
  alta: 'var(--gp-danger)',
  media: 'var(--gp-warning)',
  baixa: 'var(--gp-success)',
};

function extrairJson(bruto: string): Leitura | null {
  const inicio = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (inicio === -1 || fim <= inicio) return null;
  try {
    const obj = JSON.parse(bruto.slice(inicio, fim + 1));
    const itens = Array.isArray(obj?.itens) ? obj.itens.slice(0, 3) : [];
    if (typeof obj?.leitura !== 'string') return null;
    return { leitura: obj.leitura, itens };
  } catch {
    return null;
  }
}

/**
 * Carregamento em ETAPAS, não em skeleton (pedido explícito, 10/08): a
 * superfície é uma leitura sendo montada, então o estado de espera fala o que
 * está sendo feito, uma etapa por vez, com o cursor piscando como quem
 * escreve. É narrativa de progresso, não placeholder de layout — e as etapas
 * mudam com o escopo, porque o que está sendo lido é outro (10/08).
 */
const ETAPAS_POR_ESCOPO: Record<EscopoLeitura, string[]> = {
  recorte: [
    'Lendo o recorte de simulados…',
    'Cruzando acerto por grande área…',
    'Comparando proficiência entre semestres…',
    'Priorizando o que move a nota…',
    'Fechando a leitura…',
  ],
  institucional: [
    'Lendo o desempenho da instituição…',
    'Acompanhando a evolução entre aplicações…',
    'Cruzando com o diagnóstico curricular…',
    'Priorizando o que move o conceito…',
    'Fechando a leitura…',
  ],
};


function EtapasDaLeitura({ escopo }: { escopo: EscopoLeitura }) {
  const etapas = ETAPAS_POR_ESCOPO[escopo];
  const [indice, setIndice] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setIndice((atual) => Math.min(atual + 1, etapas.length - 1));
    }, 1400);
    return () => window.clearInterval(id);
  }, [etapas.length]);

  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-1.5">
      {etapas.slice(0, indice + 1).map((etapa, i) => {

        const atual = i === indice;
        return (
          <motion.p
            key={etapa}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: atual ? 1 : 0.45, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: atual ? 'var(--gp-text-2, inherit)' : 'var(--gp-text-3)' }}
          >
            {atual ? (
              <motion.span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: 'var(--gp-brand-on-dark)' }}
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            ) : (
              <Icon name="check" size={12} className="shrink-0 opacity-60" />
            )}
            <span className="min-w-0">{etapa}</span>
            {atual ? (
              <motion.span
                aria-hidden
                className="inline-block h-3 w-[2px] shrink-0"
                style={{ background: 'currentColor' }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
            ) : null}
          </motion.p>
        );
      })}
    </div>
  );
}

export interface LeituraEstrategicaProps {
  iesId: string | null;
  semestre: string | null;
  /** Só faz sentido no escopo `recorte`; ignorado no institucional. */
  simulados?: string[];
  /** Padrão `recorte`, o comportamento original do Detalhamento. */
  escopo?: EscopoLeitura;
}


export function LeituraEstrategica({ iesId, semestre, simulados, escopo = 'recorte' }: LeituraEstrategicaProps) {
  const [estado, setEstado] = React.useState<Estado>('idle');
  const [leitura, setLeitura] = React.useState<Leitura | null>(null);
  /** Movimento aberto no drawer de detalhe (null = fechado). */
  const [movimento, setMovimento] = React.useState<MovimentoSelecionado | null>(null);

  /* No escopo institucional o simulado não entra no recorte: a leitura é da
     instituição no período, então trocar de seleção de simulado não deve
     invalidar nem alterar esta leitura. */
  const listaSimulados = escopo === 'institucional' ? [] : (simulados ?? []);
  const chave = `${escopo}|${iesId ?? ''}|${semestre ?? ''}|${listaSimulados.join(',')}`;

  /**
   * `forcar` = pedido EXPLÍCITO da gestora (ícone de recarregar / "tentar de
   * novo"): manda `refresh: true` e o backend ignora `ai_response_cache`,
   * gerando leitura nova. Sem isso o clique devolvia o mesmo texto em cache e
   * parecia que o botão não fazia nada. A carga automática do recorte continua
   * usando cache.
   */
  const carregar = React.useCallback(async (forcar = false) => {

    if (!iesId) {
      setEstado('erro');
      return;
    }
    setEstado('loading');
    setLeitura(null);
    try {
      /* STREAMING (SSE). A leitura é longa e estruturada: esperar o JSON final
         significava tela parada por muitos segundos e, quando o modelo era
         cortado no meio, nada aparecia. Agora o backend repassa os deltas e a
         leitura vai aparecendo — o que já chegou fica na tela mesmo se o resto
         não vier. Se o streaming falhar (proxy sem suporte), cai no invoke
         bufferizado de antes. */
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      const corpo = JSON.stringify({
        modo: 'consultor',
        escopo,
        iesId,
        semestre,
        simulados: escopo === 'institucional' ? null : listaSimulados,
        stream: true,
        refresh: forcar,
      });

      const resposta = await fetch(`${env.EDGE_FUNCTIONS_BASE_URL}/gestor-ai-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token ?? env.SUPABASE_ANON_KEY}`,
        },
        body: corpo,
      });

      if (!resposta.ok || !resposta.body) throw new Error('stream_indisponivel');

      const reader = resposta.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let recebeuAlgo = false;

      const aplicar = (evento: { tipo?: string; leitura?: unknown; itens?: unknown; error?: string }) => {
        if (evento?.tipo === 'erro') throw new Error(evento.error ?? 'ai_error');
        if (typeof evento?.leitura !== 'string') return;
        setLeitura({
          leitura: evento.leitura,
          itens: Array.isArray(evento.itens) ? (evento.itens as ItemLeitura[]).slice(0, 3) : [],
        });
        recebeuAlgo = true;
        setEstado('sucesso');
      };

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
          aplicar(JSON.parse(payload));
        }
      }

      if (!recebeuAlgo) throw new Error('resposta_invalida');
      return;
    } catch {
      // Fallback bufferizado: mantém a leitura funcionando onde o SSE não passa.
      try {
        const { data, error } = await supabase.functions.invoke('gestor-ai-insights', {
          body: {
            modo: 'consultor',
            escopo,
            iesId,
            semestre,
            simulados: escopo === 'institucional' ? null : listaSimulados,
            refresh: forcar,
          },
        });
        if (error) throw error;
        const estruturado =
          typeof data?.leitura === 'string'
            ? { leitura: data.leitura as string, itens: Array.isArray(data?.itens) ? (data.itens as ItemLeitura[]).slice(0, 3) : [] }
            : null;
        const parsed = estruturado ?? extrairJson(typeof data?.insight === 'string' ? data.insight : '');
        if (!parsed) throw new Error('resposta_invalida');
        setLeitura(parsed);
        setEstado('sucesso');
      } catch {
        setEstado('erro');
      }
    }
    // `chave` cobre ies/semestre/escopo/simulados do recorte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);


  /* Recorte novo dispara uma leitura nova (pedido explícito, 10/08): a
     superfície é automática, sem clique — o botão de "Ver leitura" saiu. A
     leitura anterior nunca sobrevive à troca de recorte.
     O ref evita a chamada em dobro da remontagem de desenvolvimento (StrictMode):
     cada recorte paga no máximo uma geração. */
  const recorteJaPedido = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (recorteJaPedido.current === chave) return;
    recorteJaPedido.current = chave;
    setLeitura(null);
    carregar();
    // `carregar` já depende do mesmo recorte que compõe `chave`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);




  return (
    <section
      data-testid="bloco-leitura-estrategica"
      className="flex min-h-0 flex-col rounded-lg border border-border bg-card p-4"
      aria-labelledby="titulo-leitura-estrategica"
    >
      <header className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--gp-surface-3)', color: 'var(--gp-brand-on-dark)' }}
        >
          <Icon name="insights" variant="filled" size={18} />
        </span>
        <div className="min-w-0">
          <h3 id="titulo-leitura-estrategica" className="text-base font-semibold text-foreground">
            Leitura estratégica
          </h3>
          <p style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>consultoria de desempenho no ENAMED</p>
        </div>
        {estado === 'sucesso' ? (
          <button
            type="button"
            onClick={() => carregar(true)}
            aria-label="Atualizar leitura"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--gp-text-3)] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="refresh" size={14} />
          </button>
        ) : null}
      </header>

      <div
        className="mt-3 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: 'linear-gradient(to bottom, black calc(100% - 16px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 16px), transparent 100%)',
        }}
      >
        {estado === 'loading' || estado === 'idle' ? (
          <EtapasDaLeitura escopo={escopo} />
        ) : estado === 'erro' ? (

          <div className="flex flex-col items-start gap-2" role="alert">
            <p className="text-xs" style={{ color: 'var(--gp-text-3)' }}>
              {escopo === 'institucional'
                ? 'Não foi possível montar a leitura da instituição agora.'
                : 'Não foi possível montar a leitura deste recorte agora.'}
            </p>

            <button
              type="button"
              onClick={() => carregar(true)}
              className="rounded-sm border border-[color:var(--gp-border-strong)] px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[color:var(--gp-surface-2)]"
            >
              Tentar de novo
            </button>
          </div>
        ) : estado === 'sucesso' && leitura ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <p className="text-sm font-medium text-foreground" style={{ lineHeight: '20px' }}>
              {leitura.leitura}
            </p>
            <ul className="mt-3 space-y-2">
              {leitura.itens.map((item) => (
                <li key={item.titulo}>
                  {/* O cartão é o gatilho do detalhe (drawer): quem/como/quanto
                      não cabe aqui, mas a gestora precisa chegar lá em 1 clique. */}
                  <button
                    type="button"
                    onClick={() => setMovimento(item)}
                    aria-label={`Ver detalhe do movimento: ${item.titulo}`}
                    className="group w-full rounded-md border border-border p-2.5 text-left transition-colors hover:border-[color:var(--gp-border-strong)] hover:bg-[color:var(--gp-surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ background: 'var(--gp-surface-2)' }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: COR_PRIORIDADE[item.prioridade ?? 'media'] }}
                        />
                        <span className="min-w-0">{item.titulo}</span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-1">
                        <span className="text-base font-bold tabular-nums text-foreground">{item.metrica}</span>
                        <Icon
                          name="chevron_right"
                          size={14}
                          className="translate-y-[1px] opacity-40 transition-opacity group-hover:opacity-80"
                        />
                      </span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: 'var(--gp-text-3)', lineHeight: '17px' }}>
                      {item.texto}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

          </motion.div>
        ) : null}

      </div>

      <DrawerMovimento
        movimento={movimento}
        escopo={escopo}
        iesId={iesId}
        semestre={semestre}
        simulados={listaSimulados}
        onFechar={() => setMovimento(null)}
      />
    </section>
  );
}
