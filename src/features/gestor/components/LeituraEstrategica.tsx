import * as React from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Icon } from '@/features/gestor/components/Icon';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';

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
 * escreve. É narrativa de progresso, não placeholder de layout — e por isso
 * não usa `GestorSkeleton`.
 */
const ETAPAS = [
  'Lendo o recorte de simulados…',
  'Cruzando acerto por grande área…',
  'Comparando proficiência entre semestres…',
  'Priorizando o que move a nota…',
  'Fechando a leitura…',
];

function EtapasDaLeitura() {
  const [indice, setIndice] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setIndice((atual) => Math.min(atual + 1, ETAPAS.length - 1));
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-1.5">
      {ETAPAS.slice(0, indice + 1).map((etapa, i) => {
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
  simulados: string[];
}


export function LeituraEstrategica({ iesId, semestre, simulados }: LeituraEstrategicaProps) {
  const [estado, setEstado] = React.useState<Estado>('idle');
  const [leitura, setLeitura] = React.useState<Leitura | null>(null);

  const chave = `${iesId ?? ''}|${semestre ?? ''}|${simulados.join(',')}`;

  const carregar = React.useCallback(async () => {
    if (!iesId) {
      setEstado('erro');
      return;
    }
    setEstado('loading');
    try {
      const { data, error } = await supabase.functions.invoke('gestor-ai-insights', {
        body: { modo: 'consultor', iesId, semestre, simulados },
      });
      if (error) throw error;
      const parsed = extrairJson(typeof data?.insight === 'string' ? data.insight : '');
      if (!parsed) throw new Error('resposta_invalida');
      setLeitura(parsed);
      setEstado('sucesso');
    } catch {
      setEstado('erro');
    }
  }, [iesId, semestre, simulados]);

  /* Recorte novo dispara uma leitura nova (pedido explícito, 10/08): a
     superfície é automática, sem clique — o botão de "Ver leitura" saiu. A
     leitura anterior nunca sobrevive à troca de recorte. */
  React.useEffect(() => {
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
            onClick={carregar}
            aria-label="Atualizar leitura"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--gp-text-3)] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="refresh" size={14} />
          </button>
        ) : null}
      </header>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {estado === 'loading' || estado === 'idle' ? (
          <EtapasDaLeitura />
        ) : estado === 'erro' ? (

          <div className="flex flex-col items-start gap-2" role="alert">
            <p className="text-xs" style={{ color: 'var(--gp-text-3)' }}>
              Não foi possível montar a leitura deste recorte agora.
            </p>
            <button
              type="button"
              onClick={carregar}
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
                <li
                  key={item.titulo}
                  className="rounded-md border border-border p-2.5"
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
                    <span className="shrink-0 text-base font-bold tabular-nums text-foreground">{item.metrica}</span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--gp-text-3)', lineHeight: '17px' }}>
                    {item.texto}
                  </p>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}

      </div>
    </section>
  );
}
