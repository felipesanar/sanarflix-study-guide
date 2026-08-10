import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import { formatNumero } from '@/features/gestor/lib/formatters';

/** Proporção 0–1 para `scaleX`, sempre dentro da caixa — mesmo guard de `AcertoPorAreaESemestre.tsx`. */
const proporcao = (valor: number) => Math.max(0, Math.min(100, valor)) / 100;

/**
 * Mesma janela de movimento de `AcertoPorAreaESemestre.tsx` (`MOVIMENTO_BARRA`):
 * só `transform`/`opacity` animam (handoff §07-motion) — nunca `width`, que
 * recalcula layout a cada frame.
 */
const MOVIMENTO_BARRA: React.CSSProperties = {
  transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
};

/**
 * Grade de colunas compartilhada entre TODA `BarraProficiencia` e o
 * `EixoProficiencia` — rótulo (9rem) · trilha (1fr) · valor (4rem), com o
 * mesmo `gap`/padding horizontal dos dois lados. As duas colunas fixas são o
 * que garante que a trilha (coluna do meio) resolva para a MESMA largura em
 * pixel em toda linha e no eixo: nenhuma conta de posição feita à mão, só a
 * mesma grade repetida.
 */
const GRADE_COLUNAS = 'grid min-w-0 grid-cols-[minmax(0,7.5rem)_1fr_3.5rem] items-center gap-4';
const PADDING_HORIZONTAL = 'px-1';

/**
 * Linha vertical de meta, CONTÍNUA — refino de 10/08 (segunda rodada):
 * antes ela era desenhada uma vez por linha, presa dentro da trilha de 8px de
 * cada barra (`overflow-hidden`); no espaço ENTRE barras — o `gap`/gutter da
 * lista — não existia trilha nenhuma para ela ocupar, então a linha lia como
 * um traço picotado, presente sobre cada barra e ausente nos vãos. Pedido
 * explícito: uma linha só, do topo da lista até o eixo, atravessando os vãos.
 *
 * Por isso este componente não é mais "uma peça de cada `BarraProficiencia`"
 * — é um overlay ÚNICO, renderizado uma vez pelo chamador (`ProficienciaPorSemestreChart`),
 * como filho de um wrapper `position:relative` que também contém a lista de
 * barras e o eixo. `position:absolute; inset:0` nesse wrapper faz a linha
 * cobrir a altura INTEIRA dele — barras e vãos igualmente.
 *
 * O alinhamento horizontal continua sem nenhuma conta de pixel feita à mão:
 * este componente usa a MESMA `GRADE_COLUNAS` de toda `BarraProficiencia` e de
 * `EixoProficiencia` — a coluna do meio (a "trilha") resolve para a mesma
 * largura em pixel em toda linha da grade, então `left: 60%` dentro dela cai
 * exatamente sob o "60" do eixo e sob o mesmo ponto de toda barra acima.
 *
 * Cor: `--gp-text-3` (cinza médio, o mesmo tom das legendas do portal) —
 * DELIBERADAMENTE diferente da `ReferenceLine` vermelha de marca que
 * `DispersaoChart.tsx` usa para a mesma meta. Ali a meta é o único elemento
 * cromático do gráfico; aqui uma linha vermelha competiria com a "setinha
 * vermelha" de drill-down no fim de cada barra — duas marcas vermelhas com
 * significados diferentes na mesma lista. `--gp-border-strong` (a cor
 * original, ainda mais clara) foi descartada por ficar quase invisível no
 * tema claro contra a trilha.
 */
export function LinhaMetaContinua({ meta = PROFICIENCIA_MINIMA }: { meta?: number }) {
  return (
    <div
      aria-hidden="true"
      data-testid="linha-meta"
      className={cn(GRADE_COLUNAS, PADDING_HORIZONTAL, 'pointer-events-none absolute inset-0')}
    >
      <span />
      <span className="relative h-full">
        <span
          className="absolute inset-y-0"
          style={{
            left: `${proporcao(meta) * 100}%`,
            borderLeft: '1px dashed var(--gp-border-strong)',
            opacity: 0.9,
          }}
        />
      </span>
      <span />
    </div>
  );
}

/** Ticks do eixo — mesma escala 0–100 de toda `BarraProficiencia`. */
const TICKS_EIXO = [0, 20, 40, 60, 80, 100];

/**
 * Eixo com as notas (refino de 10/08 — pedido explícito: "coloque no eixo x
 * as notas e no valor 60 você coloca o destaque"). Renderizado UMA vez, no pé
 * da lista de barras — nunca por linha, que poluiria a lista inteira de
 * números repetidos.
 *
 * Usa a MESMA `GRADE_COLUNAS`/`PADDING_HORIZONTAL` de `BarraProficiencia`: a
 * coluna do meio (a trilha) resolve para a mesma largura em pixel da trilha
 * de toda barra acima dela, então os ticks caem exatamente sob as posições
 * que eles rotulam, sem nenhuma conta de pixel feita à mão.
 */
export function EixoProficiencia({ meta = PROFICIENCIA_MINIMA }: { meta?: number }) {
  return (
    <div className={cn(GRADE_COLUNAS, PADDING_HORIZONTAL, 'pt-1.5')} aria-hidden="true">
      <span />
      <span className="relative h-4">
        {TICKS_EIXO.map((valor) => {
          const destaque = valor === meta;
          return (
            <span
              key={valor}
              data-testid={destaque ? 'eixo-meta' : undefined}
              className={cn(
                'absolute top-0 tabular-nums',
                valor === 0 ? '' : valor === 100 ? '-translate-x-full' : '-translate-x-1/2',
              )}
              style={{
                left: `${valor}%`,
                fontSize: 11,
                fontWeight: destaque ? 700 : 400,
                color: destaque ? 'var(--gp-text-1)' : 'var(--gp-text-3)',
              }}
            >
              {valor}
            </span>
          );
        })}
      </span>
      <span />
    </div>
  );
}

export interface BarraProficienciaProps {
  /** Rótulo à esquerda — "12º semestre" no resumo, o nome do aluno no drill-down. */
  rotulo: string;
  /** `null` é ausência (§4.10): sai TRAÇO e a barra fica sem preenchimento, nunca uma barra de comprimento 0. */
  valor: number | null;
  /** Legenda pequena sob o rótulo — ex. "42 alunos". Ausente no drill-down (não há o que contar por aluno). */
  caption?: string;
  /**
   * Presente só no nível "resumo por semestre": a barra INTEIRA vira o
   * gatilho do drill-down (não um chip separado, como em
   * `AcertoPorAreaESemestre` — aqui não há um segundo alvo de clique
   * concorrendo na mesma linha, então a barra toda pode ser o botão).
   * Ausente no nível "aluno" (folha, sem próximo drill).
   */
  onClick?: () => void;
  /** Nome acessível do botão, quando `onClick` está presente. */
  ariaLabel?: string;
  testId?: string;
}

/**
 * Uma linha de barra horizontal, 0–100, e (opcionalmente) a afordância de
 * drill-down — usada pelas duas vistas de `ProficienciaPorSemestreChart`
 * (resumo por semestre e, dentro do mesmo componente, drill-down por aluno).
 * A linha de meta NÃO é desenhada aqui — ver `LinhaMetaContinua`, um overlay
 * único por lista, não por linha.
 *
 * Adapta a técnica das barras de "Acerto por grande área"
 * (`AcertoPorAreaESemestre.tsx`): `scaleX`/`transformOrigin: left` em vez de
 * `width` (única propriedade animável), cor de preenchimento única e neutra
 * (`--gp-text-1`) — nunca semáforo por linha, mesma decisão de produto já
 * documentada ali ("colorir cada barra parece alarme e rouba o destaque de
 * quem precisa dele").
 */
export function BarraProficiencia({
  rotulo,
  valor,
  caption,
  onClick,
  ariaLabel,
  testId,
}: BarraProficienciaProps) {
  const linha = (
    <>
      <span className="flex min-w-0 flex-col justify-center">
        <span className="truncate text-sm text-foreground">{rotulo}</span>
        {caption ? (
          <span className="truncate text-[11px]" style={{ color: 'var(--gp-text-3)' }}>
            {caption}
          </span>
        ) : null}
      </span>
      <span
        className="w-full overflow-hidden"
        style={{ height: 10, borderRadius: 'var(--gp-radius-pill)', background: 'var(--gp-border-subtle)' }}
      >
        {valor !== null ? (
          <span
            aria-hidden="true"
            className="block h-full w-full"
            style={{
              ...MOVIMENTO_BARRA,
              borderRadius: 'var(--gp-radius-pill)',
              transformOrigin: 'left center',
              transform: `scaleX(${proporcao(valor)})`,
              background: 'var(--gp-text-1)',
            }}
          />
        ) : null}
      </span>
      <span
        data-testid="barra-valor"
        className="flex shrink-0 items-center justify-end gap-1 text-sm tabular-nums text-foreground"
      >
        {formatNumero(valor)}
        {onClick ? (
          // A cor vem do `color` do ancestral — `Icon` não tem prop `style`
          // (o glifo herda `currentColor`, mesmo padrão de `CascataDiagnostico.tsx`
          // e do chip "Detalhar" de `AcertoPorAreaESemestre.tsx`).
          <span aria-hidden="true" className="shrink-0" style={{ color: 'var(--gp-brand-on-dark)' }}>
            <Icon name="chevron_right" variant="outlined" size={13} />
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <li data-testid={testId} className="rounded">
      {onClick ? (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onClick}
          className={cn(
            GRADE_COLUNAS,
            PADDING_HORIZONTAL,
            'w-full rounded py-1.5 text-left transition-colors duration-200',
            'cursor-pointer hover:bg-[color:var(--gp-surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {linha}
        </button>
      ) : (
        <div className={cn(GRADE_COLUNAS, PADDING_HORIZONTAL, 'py-1.5')}>{linha}</div>
      )}
    </li>
  );
}
