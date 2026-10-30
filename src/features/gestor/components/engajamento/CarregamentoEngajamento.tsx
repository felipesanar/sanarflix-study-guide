import * as React from 'react';
import { SHIMMER } from '@/features/gestor/components/GestorSkeleton';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';

/**
 * Carregamento da PRIMEIRA abertura de cada aba do Engajamento numa instituição
 * (opção C do Claude Design, aprovada em 30/10/2026): a prévia da aba apagada ao
 * fundo e, por cima, um painel com a logo girando, uma frase de bom humor, um
 * percentual e as etapas. O skeleton solto de cada bloco passava a impressão de
 * internet lenta; aqui a espera é tratada como o que ela é — a conta sendo feita.
 *
 * O percentual é ESTIMADO: cada aba vem de uma única RPC, que não informa o
 * quanto já andou. A curva sobe rápido, desacelera e para em `TETO`; só o dado
 * chegando leva a 100%. Passado o fim previsto, as frases de "quase lá" se
 * revezam para a tela não parecer travada.
 */

/** O percentual nunca passa daqui sozinho: os 100% são do dado que chegou. */
const TETO = 94;
/**
 * Constante de tempo da curva, em segundos. Calibrada na RPC mais lenta, a da
 * visão geral (pg_stat_statements, 30/10/2026: média ~3 s, máximo ~8 s): ~64%
 * aos 3 s e ~90% aos 8 s. Questões (~1,5 s, máx. ~6 s) e Conteúdos (~1,9 s,
 * máx. ~7,5 s) chegam antes e saltam para 100% no meio da curva.
 */
const TAU = 2.6;
/** Quanto o painel fica em 100% ("Prontinho!") antes de dar lugar à tela. */
export const SEGURA_CONCLUSAO_MS = 1000;
/** A partir daqui, as frases param de seguir o percentual e se revezam. */
const INICIO_DEMORA = 90;
const ROTACAO_DEMORA_S = 3;
/** Quando a curva passa de `INICIO_DEMORA` (~8,4 s). */
const SEGUNDOS_ATE_DEMORA = -TAU * Math.log(1 - INICIO_DEMORA / TETO);

const FRASES_DEMORA = [
  'Quase lá, conferindo as contas…',
  'Essa instituição tem bastante coisa para contar…',
  'Só mais um instante…',
] as const;
const FRASE_CONCLUSAO = 'Prontinho!';

/** O que muda de uma aba para outra: as frases, as etapas, o apoio e a silhueta. */
export interface RoteiroCarregamento {
  /** Linha de apoio sob a frase. */
  apoio: string;
  /** Frases por faixa de percentual: cada uma vale até `ate` (exclusivo); a última vai até `INICIO_DEMORA`. */
  frases: ReadonlyArray<{ ate: number; texto: string }>;
  etapas: ReadonlyArray<{ de: number; ate: number; rotulo: string }>;
  /** Quantos KPIs a aba tem: a prévia desenha a mesma fileira. */
  kpis: 2 | 3 | 5;
}

export const ROTEIRO_VISAO_GERAL: RoteiroCarregamento = {
  apoio: 'Montando a visão geral da instituição — a primeira abertura leva alguns segundos.',
  frases: [
    { ate: 15, texto: 'Coletando os seus dados…' },
    { ate: 32, texto: 'Contando cada vídeo assistido…' },
    { ate: 50, texto: 'Somando as questões resolvidas…' },
    { ate: 68, texto: 'Agregando e realizando as contas…' },
    { ate: 82, texto: 'Separando o hábito da visita de passagem…' },
    { ate: INICIO_DEMORA, texto: 'Desenhando os gráficos…' },
  ],
  etapas: [
    { de: 0, ate: 32, rotulo: 'Vídeos e documentos' },
    { de: 32, ate: 50, rotulo: 'Questões' },
    { de: 50, ate: 82, rotulo: 'Hábito e engajamento' },
    { de: 82, ate: 100, rotulo: 'Gráficos' },
  ],
  kpis: 5,
};

export const ROTEIRO_QUESTOES: RoteiroCarregamento = {
  apoio: 'Montando as questões da instituição — a primeira abertura leva alguns segundos.',
  frases: [
    { ate: 15, texto: 'Coletando os seus dados…' },
    { ate: 35, texto: 'Contando as questões resolvidas…' },
    { ate: 55, texto: 'Separando acertos e erros…' },
    { ate: 75, texto: 'Organizando por área, tema e assunto…' },
    { ate: INICIO_DEMORA, texto: 'Desenhando os gráficos…' },
  ],
  etapas: [
    { de: 0, ate: 35, rotulo: 'Questões resolvidas' },
    { de: 35, ate: 55, rotulo: 'Acertos' },
    { de: 55, ate: 75, rotulo: 'Temas e assuntos' },
    { de: 75, ate: 100, rotulo: 'Gráficos' },
  ],
  kpis: 3,
};

export const ROTEIRO_CONTEUDOS: RoteiroCarregamento = {
  apoio: 'Montando os conteúdos da instituição — a primeira abertura leva alguns segundos.',
  frases: [
    { ate: 15, texto: 'Coletando os seus dados…' },
    { ate: 35, texto: 'Contando cada vídeo assistido…' },
    { ate: 55, texto: 'Folheando os documentos abertos…' },
    { ate: 75, texto: 'Descobrindo os conteúdos mais vistos…' },
    { ate: INICIO_DEMORA, texto: 'Desenhando os gráficos…' },
  ],
  etapas: [
    { de: 0, ate: 35, rotulo: 'Vídeos' },
    { de: 35, ate: 55, rotulo: 'Documentos' },
    { de: 55, ate: 75, rotulo: 'Mais consumidos' },
    { de: 75, ate: 100, rotulo: 'Gráficos' },
  ],
  kpis: 2,
};

export type EstadoEtapa = 'feita' | 'atual' | 'pendente';

/** Percentual estimado (0–`TETO`) depois de `segundos` de espera. */
export function progressoEstimado(segundos: number): number {
  return TETO * (1 - Math.exp(-Math.max(0, segundos) / TAU));
}

/** Todas as frases do roteiro, na ordem em que podem aparecer: o painel empilha todas e faz cross-fade. */
export function frasesDoRoteiro(roteiro: RoteiroCarregamento): string[] {
  return [...roteiro.frases.map((f) => f.texto), ...FRASES_DEMORA, FRASE_CONCLUSAO];
}

/** Índice em `frasesDoRoteiro(roteiro)` da frase da vez. */
export function indiceDaFrase(roteiro: RoteiroCarregamento, segundos: number, concluido: boolean): number {
  if (concluido) return roteiro.frases.length + FRASES_DEMORA.length;
  const progresso = progressoEstimado(segundos);
  const porProgresso = roteiro.frases.findIndex((f) => progresso < f.ate);
  if (porProgresso >= 0) return porProgresso;
  // O revezamento conta a partir de quando a curva passou de `INICIO_DEMORA`: começa sempre por "Quase lá".
  const vez = Math.floor(Math.max(0, segundos - SEGUNDOS_ATE_DEMORA) / ROTACAO_DEMORA_S) % FRASES_DEMORA.length;
  return roteiro.frases.length + vez;
}

export function etapasDoCarregamento(
  roteiro: RoteiroCarregamento,
  progresso: number,
): Array<{ rotulo: string; estado: EstadoEtapa }> {
  return roteiro.etapas.map((e) => ({
    rotulo: e.rotulo,
    estado: progresso >= e.ate ? 'feita' : progresso >= e.de ? 'atual' : 'pendente',
  }));
}

/**
 * Quando mostrar o carregamento. Segue a regra dos 400 ms (`useDelayedLoading`):
 * resposta rápida (cache, rede boa) não mostra painel nenhum. Se o painel chegou
 * a aparecer, ele segura `SEGURA_CONCLUSAO_MS` em 100% depois que o dado chega,
 * para o "Prontinho!" ser visto em vez de a tela trocar no meio da frase.
 *
 * `inicio` é quando a espera começou (não quando o painel apareceu): o
 * percentual já entra contando os 400 ms que passaram.
 */
export function useCarregamentoInicial(carregando: boolean): {
  visivel: boolean;
  concluido: boolean;
  inicio: number;
} {
  const mostrar = useDelayedLoading(carregando);
  const [concluindo, setConcluindo] = React.useState(false);
  const [inicio, setInicio] = React.useState(() => Date.now());
  const mostrou = React.useRef(false);

  React.useEffect(() => {
    if (mostrar) mostrou.current = true;
  }, [mostrar]);

  React.useEffect(() => {
    if (carregando) {
      setInicio(Date.now());
      setConcluindo(false);
      return undefined;
    }
    if (!mostrou.current) return undefined;
    mostrou.current = false;
    setConcluindo(true);
    const temporizador = setTimeout(() => setConcluindo(false), SEGURA_CONCLUSAO_MS);
    return () => clearTimeout(temporizador);
  }, [carregando]);

  return { visivel: mostrar || concluindo, concluido: concluindo, inicio };
}

/** Segundos desde `inicio`, atualizados a cada 100 ms enquanto o componente vive. */
function useSegundosDesde(inicio: number): number {
  const [agora, setAgora] = React.useState(() => Date.now());
  React.useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 100);
    return () => clearInterval(intervalo);
  }, []);
  return Math.max(0, (agora - inicio) / 1000);
}

const CARTAO: React.CSSProperties = {
  background: 'var(--gp-surface-1)',
  border: '1px solid var(--gp-border-subtle)',
  borderRadius: 'var(--gp-radius-lg)',
  padding: 18,
};

/** Classes estáticas (o Tailwind só gera o que lê no código), na grade de KPIs de cada aba. */
const GRADE_KPIS: Record<RoteiroCarregamento['kpis'], string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  5: 'sm:grid-cols-2 lg:grid-cols-5',
};
const LARGURAS_KPI = ['55%', '50%', '60%', '45%', '58%'];
const ALTURAS_BARRAS = ['45%', '70%', '55%', '85%', '62%', '78%'];

function Mancha({ altura, largura, raio = 'var(--gp-radius-pill)' }: { altura: number; largura: string; raio?: string }) {
  return <div className="animate-shimmer" style={{ ...SHIMMER, height: altura, width: largura, borderRadius: raio }} />;
}

/** Silhueta da aba (KPIs, dois gráficos e a tabela), só decorativa. */
function PreviaAba({ kpis }: { kpis: RoteiroCarregamento['kpis'] }) {
  return (
    <div aria-hidden="true" data-testid="carregamento-previa" className="flex flex-col gap-4" style={{ opacity: 0.55 }}>
      <div className={`grid gap-3.5 ${GRADE_KPIS[kpis]}`}>
        {LARGURAS_KPI.slice(0, kpis).map((largura, i) => (
          <div key={i} className="flex flex-col" style={{ ...CARTAO, gap: 10 }}>
            <Mancha altura={10} largura={largura} />
            <Mancha altura={28} largura="40%" raio="var(--gp-radius-sm)" />
            <Mancha altura={10} largura="75%" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col" style={{ ...CARTAO, gap: 16 }}>
          <Mancha altura={12} largura="40%" />
          <div className="flex items-end" style={{ height: 220, gap: 14, borderBottom: '1px solid var(--gp-border-subtle)' }}>
            {ALTURAS_BARRAS.map((altura, i) => (
              <div
                key={i}
                className="gp-carregamento-barra"
                style={{
                  flex: 1,
                  height: altura,
                  background: 'var(--gp-skeleton)',
                  borderRadius: '6px 6px 0 0',
                  animationDelay: `${i * 120}ms`,
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col" style={{ ...CARTAO, gap: 16 }}>
          <Mancha altura={12} largura="35%" />
          <div className="flex flex-col justify-center" style={{ height: 220, gap: 14 }}>
            {['92%', '70%', '52%', '31%'].map((largura) => (
              <Mancha key={largura} altura={22} largura={largura} raio="var(--gp-radius-sm)" />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col" style={{ ...CARTAO, gap: 12 }}>
        <Mancha altura={12} largura="25%" />
        <Mancha altura={14} largura="100%" />
        <Mancha altura={14} largura="100%" />
      </div>
    </div>
  );
}

function MarcaEtapa({ estado }: { estado: EstadoEtapa }) {
  if (estado === 'feita') {
    return (
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7.3 5.8 10 11 4" />
      </svg>
    );
  }
  if (estado === 'atual') {
    return (
      <span
        aria-hidden="true"
        className="gp-carregamento-pulso"
        style={{ width: 8, height: 8, margin: '0 3px', borderRadius: '50%', background: 'var(--gp-brand)' }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: 8, height: 8, margin: '0 3px', borderRadius: '50%', border: '1.5px solid var(--gp-border-input)', boxSizing: 'border-box' }}
    />
  );
}

const ROTULO_ESTADO: Record<EstadoEtapa, string> = { feita: 'concluída', atual: 'em andamento', pendente: 'a seguir' };
const COR_ETAPA: Record<EstadoEtapa, string> = {
  feita: 'var(--gp-brand-on-dark)',
  atual: 'var(--gp-text-1)',
  pendente: 'var(--gp-text-3)',
};

export interface CarregamentoEngajamentoProps {
  roteiro: RoteiroCarregamento;
  /** Quando a espera começou (`Date.now()`), de `useCarregamentoInicial`. */
  inicio: number;
  /** O dado chegou: o painel mostra 100% e "Prontinho!". */
  concluido: boolean;
}

export function CarregamentoEngajamento({ roteiro, inicio, concluido }: CarregamentoEngajamentoProps) {
  const segundos = useSegundosDesde(inicio);
  const progresso = concluido ? 100 : progressoEstimado(segundos);
  const pct = Math.floor(progresso);
  const frases = frasesDoRoteiro(roteiro);
  const frase = indiceDaFrase(roteiro, segundos, concluido);

  return (
    <div className="relative" data-testid="carregamento-engajamento">
      <PreviaAba kpis={roteiro.kpis} />
      <section
        role="status"
        aria-label="Carregando Engajamento"
        className="absolute left-1/2 flex -translate-x-1/2 flex-col"
        style={{
          top: 72,
          width: 580,
          maxWidth: 'calc(100% - 32px)',
          gap: 14,
          padding: '20px 22px 18px',
          boxSizing: 'border-box',
          background: 'var(--gp-surface-1)',
          border: '1px solid var(--gp-border-subtle)',
          borderRadius: 16,
          boxShadow: 'var(--gp-tooltip-shadow)',
        }}
      >
        <div className="flex items-center" style={{ gap: 16 }}>
          <div
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center"
            style={{ width: 64, height: 48, perspective: 500, background: 'var(--gp-brand-surface)', borderRadius: 12 }}
          >
            <img className="gp-carregamento-moeda" src="/sanarflix-academy-symbol.svg" alt="" style={{ width: 50, height: 'auto' }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 3 }}>
            <div className="relative" style={{ height: 22 }}>
              {frases.map((texto, i) => (
                <p
                  key={texto}
                  aria-hidden={i === frase ? undefined : true}
                  data-ativa={i === frase ? 'true' : undefined}
                  className="absolute inset-0 truncate"
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--gp-text-1)',
                    opacity: i === frase ? 1 : 0,
                    transform: `translateY(${i === frase ? 0 : i < frase ? -10 : 10}px)`,
                    // A que sai some rápido; a que entra espera ela sair, para as duas não se sobreporem.
                    transition:
                      i === frase
                        ? 'opacity var(--gp-motion-4) var(--gp-ease) var(--gp-motion-2), transform var(--gp-motion-4) var(--gp-ease) var(--gp-motion-2)'
                        : 'opacity var(--gp-motion-2) var(--gp-ease-out), transform var(--gp-motion-2) var(--gp-ease-out)',
                  }}
                >
                  {texto}
                </p>
              ))}
            </div>
            <p style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>{roteiro.apoio}</p>
          </div>
          <div aria-hidden="true" className="flex shrink-0 items-baseline tabular-nums" style={{ gap: 1 }}>
            <span data-testid="carregamento-pct" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--gp-text-1)' }}>
              {pct}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--gp-text-3)' }}>%</span>
          </div>
        </div>

        <div
          role="progressbar"
          aria-label="Progresso estimado do carregamento"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          style={{ height: 6, background: 'var(--gp-brand-surface)', borderRadius: 'var(--gp-radius-pill)', overflow: 'hidden' }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--gp-brand)',
              borderRadius: 'var(--gp-radius-pill)',
              transition: 'width 350ms ease-out',
            }}
          />
        </div>

        <ol aria-label="Etapas" className="flex flex-wrap" style={{ gap: '6px 18px' }}>
          {etapasDoCarregamento(roteiro, progresso).map((etapa) => (
            <li
              key={etapa.rotulo}
              data-estado={etapa.estado}
              className="flex items-center"
              style={{ gap: 6, fontSize: 12, fontWeight: 500, color: COR_ETAPA[etapa.estado] }}
            >
              <MarcaEtapa estado={etapa.estado} />
              {etapa.rotulo}
              <span className="sr-only">({ROTULO_ESTADO[etapa.estado]})</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/**
 * Casca de uma aba na primeira abertura: o painel no lugar dos blocos enquanto a
 * RPC da aba não tem dado nenhum. Os blocos continuam montados, só escondidos,
 * para as consultas próprias deles (tabela "Por aluno", listas) correrem em
 * paralelo à da aba em vez de depois dela. Troca de filtro com dado anterior em
 * tela não passa por aqui: o dado fica, a 60% de opacidade, como antes.
 */
export function ComCarregamentoInicial({
  carregando,
  roteiro,
  children,
}: {
  /** A RPC da aba está carregando e ainda não há dado nenhum. */
  carregando: boolean;
  roteiro: RoteiroCarregamento;
  children: React.ReactNode;
}) {
  const carregamento = useCarregamentoInicial(carregando);
  const esconder = carregando || carregamento.visivel;

  return (
    <>
      {carregamento.visivel ? (
        <CarregamentoEngajamento roteiro={roteiro} inicio={carregamento.inicio} concluido={carregamento.concluido} />
      ) : carregando ? (
        // Até a regra dos 400 ms liberar o painel: a altura dele, em branco, sem flash.
        <div data-testid="carregamento-aguardando" aria-hidden="true" style={{ minHeight: 640 }} />
      ) : null}
      <div hidden={esconder} className={esconder ? 'hidden' : 'flex min-w-0 flex-col gap-4'}>
        {children}
      </div>
    </>
  );
}
