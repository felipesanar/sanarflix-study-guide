import { cn } from '@/lib/utils';
import { formatPct } from '../lib/formatters';
import type { Alternativa } from '../api/types';

/**
 * Derivação exata (não estimativa): a incorreta mais marcada. Usada só quando o
 * servidor não manda `distratorDominante`.
 */
export function derivarDistratorDominante(alternativas: Alternativa[]): Alternativa['letra'] | undefined {
  const incorretas = alternativas.filter((a) => !a.correta && (a.marcadaPct ?? 0) > 0);
  if (incorretas.length === 0) return undefined;
  return incorretas.reduce((maior, a) => ((a.marcadaPct ?? 0) > (maior.marcadaPct ?? 0) ? a : maior)).letra;
}

/**
 * Papel da alternativa na leitura do bloco (handoff §7, docs/06-data-viz.md):
 * correta em SUCESSO, distrator mais marcado em ERRO, demais em neutro.
 *
 * Antes os dois primeiros saíam na mesma família cromática — a correta em
 * `--primary` (o vinho da marca) e o distrator em `--destructive` (vermelho):
 * dois vermelhos lado a lado apagavam exatamente a leitura que o gráfico
 * existe para dar ("verde é o gabarito, vermelho é a armadilha").
 */
type PapelAlternativa = 'correta' | 'distrator' | 'neutro';

const COR_BARRA: Record<PapelAlternativa, string> = {
  correta: 'var(--gp-success)',
  distrator: 'var(--gp-danger)',
  neutro: 'var(--gp-text-3)',
};

/** Cor de TEXTO (letra e %) — o par `-on` do mesmo semântico, calibrado para AA. */
const COR_TEXTO: Record<PapelAlternativa, string> = {
  correta: 'var(--gp-success-on)',
  distrator: 'var(--gp-danger-on)',
  neutro: 'var(--gp-text-2)',
};

/**
 * A única exceção de raio do portal (handoff §7): a barra por alternativa é
 * 16px de altura com raio 4px, não pílula. Os demais raios continuam presos
 * aos tokens `--gp-radius-*`.
 */
const RAIO_BARRA = 4;

const CLASSE_KICKER = 'text-[10px] font-bold uppercase tracking-[0.06em]';

export interface DistribuicaoAlternativasProps {
  alternativas: Alternativa[];
  distratorDominante?: Alternativa['letra'];
  /**
   * `n` da amostra, impresso no título ("· 98 respostas"). Sem ele o título sai
   * sozinho — nunca um número inventado. Hoje `Questao` não carrega este campo
   * (a RPC não devolve), então o consumidor real não o passa.
   */
  respostas?: number | null;
}

export function DistribuicaoAlternativas({
  alternativas,
  distratorDominante,
  respostas,
}: DistribuicaoAlternativasProps) {
  const dominante = distratorDominante ?? derivarDistratorDominante(alternativas);

  const papelDe = (alt: Alternativa): PapelAlternativa =>
    alt.correta ? 'correta' : alt.letra === dominante ? 'distrator' : 'neutro';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className={CLASSE_KICKER} style={{ color: 'var(--gp-text-3)' }}>
          Alternativas
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          {alternativas.map((alt) => {
            const papel = papelDe(alt);
            return (
              <li
                key={alt.letra}
                data-testid={`alternativa-${alt.letra}`}
                data-correta={String(alt.correta)}
                className={cn('leading-snug', papel !== 'neutro' && 'font-semibold')}
                style={{ color: COR_TEXTO[papel] }}
              >
                <span className="font-semibold">{alt.letra}.</span> {alt.texto}
                {/* Rótulo por extenso: cor nunca é o único canal (§11 e §06 princípio 2). */}
                {alt.correta && ' · alternativa correta'}
                {papel === 'distrator' && (
                  /* Task: contraste AA de "distrator dominante" (texto, text-xs — mínimo 4,5:1).
                     Este chip é o caso "texto sobre --gp-*-surface" citado em gestor-theme.css: o
                     fundo real não é o card puro, é bg-destructive/10 (destructive a 10% composto
                     sobre o card, valor exato em contrasteDestructive.test.tsx). Contra esse fundo
                     tintado, text-destructive dava 3,31:1 no claro e 3,26:1 no escuro (reprova AA).
                     Mantendo o mesmo bg-destructive/10 (não é o que falha — só o texto), trocar para
                     gp-text-danger (--gp-danger-on) dá 9,71:1 no claro e 6,70:1 no escuro. */
                  /* O raio é o pill dos tokens: `rounded` do Tailwind é 4px, e
                     4px só existe na barra (a exceção documentada do §7). */
                  <span
                    className="ml-2 inline-block bg-destructive/10 px-1.5 py-0.5 text-xs gp-text-danger"
                    style={{ borderRadius: 'var(--gp-radius-pill)' }}
                  >
                    distrator dominante
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className={cn(CLASSE_KICKER, 'mb-2.5')} style={{ color: 'var(--gp-text-3)' }}>
          Distribuição por alternativa
          {respostas !== undefined && respostas !== null ? ` · ${respostas} respostas` : ''}
        </p>

        <ul className="flex flex-col gap-2" aria-label="Distribuição das marcações por alternativa">
          {alternativas.map((alt) => {
            const papel = papelDe(alt);
            const fracao = Math.max(0, Math.min(100, alt.marcadaPct ?? 0)) / 100;
            return (
              <li
                key={alt.letra}
                data-testid={`distribuicao-${alt.letra}`}
                data-correta={String(alt.correta)}
                className="grid grid-cols-[14px_1fr_56px] items-center gap-3 text-xs"
              >
                <span
                  className={papel === 'neutro' ? undefined : 'font-bold'}
                  style={{ color: COR_TEXTO[papel] }}
                >
                  {alt.letra}
                </span>
                <span
                  className="block h-4 overflow-hidden"
                  style={{ borderRadius: RAIO_BARRA, background: 'var(--gp-surface-3)' }}
                >
                  {/* Regra de ouro de movimento: anima só `transform`/`opacity`, nunca
                      `width` — largura é layout e reflui a linha inteira a cada recorte. */}
                  <span
                    aria-hidden="true"
                    className="block h-full w-full origin-left transition-transform duration-200"
                    style={{
                      borderRadius: RAIO_BARRA,
                      background: COR_BARRA[papel],
                      transform: `scaleX(${fracao})`,
                    }}
                  />
                </span>
                <span
                  className={cn('text-right font-mono tabular-nums', papel !== 'neutro' && 'font-semibold')}
                  style={{ color: COR_TEXTO[papel] }}
                >
                  {formatPct(alt.marcadaPct)}
                </span>
              </li>
            );
          })}
        </ul>

        <p
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]"
          style={{ color: 'var(--gp-text-3)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0"
              style={{ borderRadius: 'var(--gp-radius-pill)', background: COR_BARRA.correta }}
            />
            correta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0"
              style={{ borderRadius: 'var(--gp-radius-pill)', background: COR_BARRA.distrator }}
            />
            distrator mais marcado
          </span>
          {dominante ? (
            /* A frase de leitura é o produto do bloco: sem ela o gestor sai com quatro
               barras e nenhuma interpretação (docs/06-data-viz.md §Princípios). */
            <span data-testid="distribuicao-leitura" className="sm:ml-auto">
              o distrator {dominante} domina — sinaliza confusão conceitual, não só dificuldade
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
