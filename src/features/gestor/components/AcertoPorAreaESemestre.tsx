import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { recalcularAreas, recalcularSemestres } from '../lib/agregarDetalhamento';
import { formatPct } from '../lib/formatters';
import type { CelulaAreaSemestre, RecorteCruzado } from '../api/detalhamentoExtras';
import type { AcertoPorAreaESemestre as AcertoPorAreaESemestreDados, FiltroSemestre } from '../api/types';

/**
 * Evidência derivada do filtro global (§4.5). O campo `emEvidencia` que vem no
 * envelope é o eco do servidor e não é usado para estilo — derivar no cliente
 * garante que a evidência nunca desincronize da URL.
 */
export function semestresEmEvidencia(semestre: FiltroSemestre, disponiveis: number[]): number[] {
  if (semestre === 'geral') return [...disponiveis];
  if (semestre === '6ano') return disponiveis.filter((s) => s === 11 || s === 12);
  const alvo = Number(semestre);
  return disponiveis.filter((s) => s === alvo);
}

export interface AcertoPorAreaESemestreProps {
  dados: AcertoPorAreaESemestreDados;
  semestre: FiltroSemestre;
  matriz?: CelulaAreaSemestre[];
  recorte?: RecorteCruzado | null;
  onRecorteChange?: (recorte: RecorteCruzado | null) => void;
}

const MOTIVO_SEM_MATRIZ = 'Recorte cruzado indisponível para esta seleção';

/** Proporção 0–1 para `scaleX`/`scaleY`, sempre dentro da caixa. */
const proporcao = (pct: number) => Math.max(0, Math.min(100, pct)) / 100;

/**
 * `motion-3` (200ms) na curva padrão, aplicada só a `transform`/`opacity` —
 * as duas únicas propriedades que o handoff §07-motion permite animar. Antes
 * daqui saíam `transition-[width]` e `transition-[height]`, que recalculam
 * layout a cada frame do clique cruzado.
 */
const MOVIMENTO_BARRA: React.CSSProperties = {
  transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
};

/**
 * Tom ÚNICO e neutro para as barras de grande área. Sair da marca
 * (`bg-primary`, vermelho SanarFlix) importa: pintar cinco áreas de vermelho
 * fazia toda a lista parecer alarme e roubava o único destaque que deve
 * gritar, o da área crítica.
 *
 * Aqui saía uma rampa de três neutros aplicada por ÍNDICE, e o índice é a
 * ordem ALFABÉTICA em que a RPC entrega as áreas — não o ranking. A cor
 * prometia um ordenamento que o dado não tinha: Cirurgia (41%) saía no tom
 * mais escuro e Clínica Médica (72%) no médio, e com mais áreas que degraus a
 * rampa ainda ciclava, dando o mesmo tom a desempenhos muito distantes.
 *
 * Ordenar por `acertoPct` antes de pintar não resolve neste componente: o
 * recorte cruzado RECALCULA o percentual de cada área a cada clique
 * (`recalcularAreas`), então a lista se reembaralharia debaixo do cursor a cada
 * seleção — e a rampa de três degraus continuaria ciclando com cinco áreas.
 * Com tom único, a cor deixa de afirmar ranking e o comprimento da barra volta
 * a ser o único canal de comparação, que é o único que carrega o número.
 */
const TOM_BARRA_AREA = 'var(--gp-text-1)';

/**
 * Largura máxima de uma coluna de semestre.
 *
 * Sem teto, `flex-1` reparte a largura do card entre os semestres presentes —
 * com UM semestre no recorte, a "barra" virava um bloco de 1000×128px, e o
 * raio de pílula (`10em`, ~160px) arredondava tanto as pontas que o resultado
 * lia como um comprimido gigante deitado, não como um gráfico. O teto mantém
 * a coluna com proporção de barra em qualquer quantidade de semestres.
 */
const LARGURA_MAX_COLUNA = 76;

/**
 * Raio das barras verticais — 4px, NÃO a pílula.
 *
 * A barra cresce por `scaleY` (única propriedade animável, §07-motion), e
 * `scaleY` esmaga o raio junto: um canto de 160px sob `scaleY(0.6)` vira uma
 * elipse de 160×96 e a barra inteira aparece como um oval. Em 4px a distorção
 * é imperceptível e o desenho continua sendo uma barra.
 */
const RAIO_BARRA_SEMESTRE = 4;

/** Dica de interação — o handoff não põe ícone aqui; o que faltava era a frase. */
function DicaDeClique({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs" style={{ color: 'var(--gp-text-3)' }}>
      {children}
    </p>
  );
}

export function AcertoPorAreaESemestre({
  dados,
  semestre,
  matriz,
  recorte = null,
  onRecorteChange,
}: AcertoPorAreaESemestreProps) {
  const interativo = typeof onRecorteChange === 'function';
  const cruzamentoDisponivel = Boolean(matriz && matriz.length > 0);
  const idMotivo = React.useId();

  const areas =
    cruzamentoDisponivel && recorte?.tipo === 'semestre'
      ? recalcularAreas(dados.areas, matriz ?? [], Number(recorte.id))
      : dados.areas;

  const semestres =
    cruzamentoDisponivel && recorte?.tipo === 'area'
      ? recalcularSemestres(dados.semestres, matriz ?? [], recorte.id)
      : dados.semestres;

  const evidentes = semestresEmEvidencia(
    semestre,
    semestres.map((s) => s.semestre),
  );

  const alternar = (proximo: RecorteCruzado) => {
    if (!onRecorteChange || !cruzamentoDisponivel) return;
    const igual = recorte?.tipo === proximo.tipo && recorte.id === proximo.id;
    onRecorteChange(igual ? null : proximo);
  };

  const rotuloRecorte =
    recorte === null
      ? null
      : recorte.tipo === 'semestre'
        ? `${recorte.id}º semestre`
        : (dados.areas.find((a) => a.id === recorte.id)?.nome ?? recorte.id);

  return (
    <section
      role="region"
      aria-label="Acerto por grande área e por semestre"
      className="space-y-6 rounded-lg border border-border bg-card p-4"
    >
      {rotuloRecorte && (
        <p data-testid="recorte-ativo" className="flex items-center gap-2 text-sm text-muted-foreground">
          Recorte:
          {/* O "x" mora DENTRO da pílula do recorte, como o remove-chip da
              referência — não como um link "limpar recorte" solto ao lado. */}
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
            style={{
              borderRadius: 'var(--gp-radius-pill)',
              padding: '3px 11px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--gp-surface-3)',
              color: 'var(--gp-text-1)',
            }}
          >
            {rotuloRecorte}
            {interativo ? (
              <button
                type="button"
                aria-label="Limpar recorte"
                onClick={() => onRecorteChange?.(null)}
                className="inline-flex items-center focus-visible:outline-none"
                style={{ color: 'var(--gp-text-3)' }}
              >
                <Icon name="close" variant="outlined" size={13} />
              </button>
            ) : null}
          </span>
        </p>
      )}

      {/*
        Indisponibilidade PERCEPTÍVEL sem mouse: o motivo é texto na tela e
        chega por `aria-describedby`. As barras continuam focáveis
        (`aria-disabled`, nunca `disabled`) — `disabled` as tirava da ordem de
        tabulação e escondia o clique cruzado inteiro de quem usa teclado.
      */}
      {interativo && !cruzamentoDisponivel ? (
        <p id={idMotivo} data-testid="motivo-sem-cruzamento" className="text-xs text-muted-foreground">
          {MOTIVO_SEM_MATRIZ}
        </p>
      ) : null}

      <div>
        {/*
          A dica de clique não é enfeite: o cruzamento área × semestre era
          invisível. As linhas eram `<button>` sem nenhuma marca de controle —
          sem cursor de mão, sem hover, sem uma palavra dizendo que dava para
          clicar —, então a funcionalidade central deste bloco só existia para
          quem tropeçasse nela. `mb-3` migra do `h3` para a dica: o par
          título+dica é que fica separado da lista.
        */}
        {/* h2, não h3: são títulos de bloco de PRIMEIRO nível da rota, o
            mesmo nível que `EvolucaoRecorte` e `BlocoGestor` usam. Com h3, e
            sem nenhum h2 antes deles — o que acontece sempre que a "Evolução
            do recorte" não é montada, ou seja, com um simulado só —, o leitor
            de tela pula de h1 para h3 e o axe acusa heading-order (§11). */}
        <h2 className={cn('text-base font-semibold text-foreground', interativo ? 'mb-1' : 'mb-3')}>
          Acerto por grande área
        </h2>
        {interativo && cruzamentoDisponivel ? (
          <DicaDeClique>
            Clique numa área para recortar os semestres por ela. Clique de novo para limpar.
          </DicaDeClique>
        ) : null}
        {areas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dado de grande área neste recorte</p>
        ) : (
          <ul className="space-y-2">
            {areas.map((area) => {
              const ativo = recorte?.tipo === 'area' && recorte.id === area.id;
              // Recorte por ÁREA esmaece as demais áreas (o item selecionado
              // recebe contorno **e o restante esmaece**, docs/06-data-viz §4).
              const esmaecida = recorte?.tipo === 'area' && !ativo;
              const linha = (
                <>
                  {/* Task: contraste AA do nome da área crítica (texto, text-sm, peso normal —
                      mínimo 4,5:1). `text-destructive` reprovava contra os fundos reais deste
                      <span> — card (padrão) e card+primary/5% (recorte "ativo"): 3,78:1/3,48:1 no
                      claro, 3,48:1/3,40:1 no escuro. `gp-text-danger` resolve para --gp-danger-on:
                      11,09:1/10,20:1 no claro e 7,15:1/6,97:1 no escuro. Ver contrasteDestructive.test.tsx. */}
                  <span className={cn('truncate text-left text-sm', area.critica ? 'gp-text-danger' : 'text-foreground')}>
                    {area.nome}
                  </span>
                  <span
                    className="w-full overflow-hidden"
                    style={{
                      height: 8,
                      borderRadius: 'var(--gp-radius-pill)',
                      background: 'var(--gp-border-subtle)',
                    }}
                  >
                    {/* A área crítica é o único destaque cromático da lista —
                        as demais dividem o mesmo neutro. */}
                    <span
                      aria-hidden="true"
                      className={cn('block h-full w-full', area.critica ? 'bg-destructive' : undefined)}
                      style={{
                        ...MOVIMENTO_BARRA,
                        borderRadius: 'var(--gp-radius-pill)',
                        transformOrigin: 'left center',
                        transform: `scaleX(${proporcao(area.acertoPct)})`,
                        ...(area.critica ? null : { background: TOM_BARRA_AREA }),
                      }}
                    />
                  </span>
                  <span
                    data-testid="area-valor"
                    className="text-right text-sm tabular-nums text-foreground transition-opacity duration-200"
                  >
                    {formatPct(area.acertoPct)}
                  </span>
                </>
              );

              return (
                <li
                  key={area.id}
                  data-testid={`area-${area.id}`}
                  data-critica={String(area.critica)}
                  data-recorte={ativo ? 'ativo' : 'inativo'}
                  className={cn(
                    'rounded transition-opacity duration-200',
                    ativo && 'bg-primary/5 ring-1 ring-primary/30',
                    esmaecida ? 'opacity-40' : 'opacity-100',
                  )}
                >
                  {interativo ? (
                    <button
                      type="button"
                      aria-disabled={!cruzamentoDisponivel}
                      aria-describedby={cruzamentoDisponivel ? undefined : idMotivo}
                      title={cruzamentoDisponivel ? undefined : MOTIVO_SEM_MATRIZ}
                      aria-pressed={ativo}
                      onClick={() => alternar({ tipo: 'area', id: area.id })}
                      /* `cursor-pointer` + hover: as duas marcas que dizem
                         "isto é um controle" antes de qualquer clique.
                         `aria-disabled` desfaz as duas quando o cruzamento
                         não está disponível — o botão continua focável (ver
                         o comentário do motivo, acima), mas para de prometer
                         um clique que não vai acontecer. */
                      className={cn(
                        'grid w-full grid-cols-[10rem_1fr_3.5rem] items-center gap-3 rounded px-1 py-1',
                        'transition-colors duration-200',
                        cruzamentoDisponivel
                          ? 'cursor-pointer hover:bg-[color:var(--gp-surface-3)]'
                          : 'cursor-default',
                      )}
                    >
                      {linha}
                    </button>
                  ) : (
                    <div className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-3 px-1 py-1">{linha}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/*
        Com UM semestre, a seção inteira some.

        Uma barra sozinha não compara nada — o número dela é o mesmo do
        recorte, já dito acima —, e o clique cruzado que ela oferece é um
        no-op: recortar as grandes áreas "pelo 11º semestre" quando só existe
        o 11º devolve exatamente as mesmas áreas. Sobrava meia tela de altura
        para um controle que promete um filtro sem efeito.

        `=== 1`, não `<= 1`: com ZERO semestres o bloco continua aparecendo
        com "Sem dado de semestre neste recorte". Aí não é redundância, é
        ausência — e ausência o portal diz, não esconde (§4.10).
      */}
      {semestres.length === 1 ? null : (
      <div>
        <h2 className={cn('text-base font-semibold text-foreground', interativo ? 'mb-1' : 'mb-3')}>
          Acerto por semestre
        </h2>
        {interativo && cruzamentoDisponivel ? (
          <DicaDeClique>
            Clique num semestre para recortar as grandes áreas por ele. Clique de novo para limpar.
          </DicaDeClique>
        ) : null}
        {semestres.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dado de semestre neste recorte</p>
        ) : (
          /* `justify-start` + teto de largura por coluna: com poucos
             semestres as barras ficam do lado esquerdo, com proporção de
             barra, em vez de esticarem até virar blocos. */
          <ul className="flex items-end justify-start gap-3">
            {semestres.map((s) => {
              const emEvidencia = evidentes.includes(s.semestre);
              const ativo = recorte?.tipo === 'semestre' && recorte.id === String(s.semestre);
              // Duas causas de esmaecimento, independentes: o filtro global
              // (6º ano evidencia 11º/12º) e o recorte cruzado ativo.
              const esmaecida = !emEvidencia || (recorte?.tipo === 'semestre' && !ativo);
              const coluna = (
                <>
                  <span className="text-xs tabular-nums text-foreground transition-opacity duration-200">
                    {formatPct(s.acertoPct)}
                  </span>
                  <span
                    className="flex h-32 w-full items-end overflow-hidden"
                    style={{
                      borderRadius: RAIO_BARRA_SEMESTRE,
                      background: 'var(--gp-surface-3)',
                    }}
                  >
                    {/* A evidência do filtro global também é TONAL, não só
                        opacidade: o semestre em evidência vem no neutro escuro
                        e os demais no neutro claro. Opacidade sozinha some em
                        tela clara, e era o único sinal de que "6º ano" recorta
                        11º e 12º. */}
                    <span
                      aria-hidden="true"
                      className="block h-full w-full"
                      style={{
                        ...MOVIMENTO_BARRA,
                        borderRadius: RAIO_BARRA_SEMESTRE,
                        transformOrigin: 'bottom center',
                        transform: `scaleY(${proporcao(s.acertoPct)})`,
                        background: emEvidencia ? 'var(--gp-text-1)' : 'var(--gp-border-input)',
                      }}
                    />
                  </span>
                  <span className="text-xs text-muted-foreground">{s.semestre}º semestre</span>
                </>
              );

              return (
                <li
                  key={s.semestre}
                  data-testid={`semestre-${s.semestre}`}
                  data-evidencia={String(emEvidencia)}
                  data-recorte={ativo ? 'ativo' : 'inativo'}
                  style={{ maxWidth: LARGURA_MAX_COLUNA }}
                  className={cn(
                    'flex flex-1 transition-opacity duration-200',
                    esmaecida ? 'opacity-40' : 'opacity-100',
                    ativo && 'rounded bg-primary/5 ring-1 ring-primary/30',
                  )}
                >
                  {interativo ? (
                    <button
                      type="button"
                      aria-disabled={!cruzamentoDisponivel}
                      aria-describedby={cruzamentoDisponivel ? undefined : idMotivo}
                      title={cruzamentoDisponivel ? undefined : MOTIVO_SEM_MATRIZ}
                      aria-pressed={ativo}
                      onClick={() => alternar({ tipo: 'semestre', id: String(s.semestre) })}
                      /* Mesmas duas marcas de controle das linhas de área. */
                      className={cn(
                        'flex w-full flex-col items-center gap-1 rounded p-1 transition-colors duration-200',
                        cruzamentoDisponivel
                          ? 'cursor-pointer hover:bg-[color:var(--gp-surface-3)]'
                          : 'cursor-default',
                      )}
                    >
                      {coluna}
                    </button>
                  ) : (
                    <div className="flex w-full flex-col items-center gap-1">{coluna}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      )}
    </section>
  );
}
