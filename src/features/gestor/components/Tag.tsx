import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import { ROTULO_NIVEL } from '@/features/gestor/components/ChipNivel';
import type { NivelDesempenho } from '@/features/gestor/api/types';

/**
 * Anatomias de tag/badge/pílula do Portal do Gestor — handoff §5.
 *
 * O handoff é fechado: **só existem estas anatomias**. Nada de raio 4px, nada
 * de fundo colorido forte, nada de cor sem rótulo textual. Elas moram todas
 * aqui para que não haja como improvisar uma décima primeira num componente
 * qualquer — que foi exatamente como o portal acumulou `Badge variant=
 * "secondary"` do shadcn no lugar das anatomias reais.
 *
 * Todas partilham: raio `--gp-radius-pill` (10em), `inline-flex` centrado,
 * `white-space: nowrap` e nenhuma sombra.
 */
export type TagVariant =
  | 'positivo'
  | 'neutro'
  | 'ausencia'
  | 'qualificador'
  | 'selo'
  | 'contador'
  | 'modalidade';

/** Cada anatomia é size + cor + padding exatos. Nenhum valor solto no consumidor. */
const ANATOMIA: Record<TagVariant, React.CSSProperties> = {
  /** Status positivo — "Proficiente". 11px, success-on sobre success-surface, sem borda. */
  positivo: {
    fontSize: 11,
    color: 'var(--gp-success-on)',
    background: 'var(--gp-success-surface)',
    padding: '2px 9px',
  },
  /** Status neutro — "Abaixo do limiar". 11px, text-2, borda 1px, fundo transparente. */
  neutro: {
    fontSize: 11,
    color: 'var(--gp-text-2)',
    background: 'transparent',
    border: '1px solid var(--gp-border-input)',
    padding: '2px 9px',
  },
  /** Ausência — "Não participou". 11px, text-3, borda 1px **tracejada**. */
  ausencia: {
    fontSize: 11,
    color: 'var(--gp-text-3)',
    background: 'transparent',
    border: '1px dashed var(--gp-border-input)',
    padding: '2px 9px',
  },
  /** Qualificador — "projetado". 9px/600 uppercase, warning-on sobre warning-surface. */
  qualificador: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--gp-warning-on)',
    background: 'var(--gp-warning-surface)',
    padding: '1px 6px',
  },
  /** Selo "atual". 9px/700 uppercase, marca sobre brand-surface. */
  selo: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--gp-brand-on-dark, var(--gp-brand))',
    background: 'var(--gp-brand-surface)',
    padding: '2px 7px',
  },
  /** Contador de resumo. 11px/600, text-2 sobre surface-3. */
  contador: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--gp-text-2)',
    background: 'var(--gp-surface-3)',
    padding: '5px 12px',
  },
  /** Modalidade — "Online síncrono". 11px, text-3, borda 1px divisor forte. */
  modalidade: {
    fontSize: 11,
    color: 'var(--gp-text-3)',
    background: 'transparent',
    border: '1px solid var(--gp-border-strong)',
    padding: '3px 10px',
  },
};

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: TagVariant;
  children: React.ReactNode;
}

export function Tag({ variant, children, className, style, ...rest }: TagProps) {
  return (
    <span
      {...rest}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap leading-none', className)}
      style={{ borderRadius: 'var(--gp-radius-pill)', ...ANATOMIA[variant], ...style }}
    >
      {children}
    </span>
  );
}

/**
 * Delta (+2, −3) — 11px/600, semântico on/surface, com `arrow_upward-filled` 10px.
 *
 * Delta zero não é "sem delta": é uma medição que deu estabilidade, e vai em
 * tom neutro. **Ausência** de delta é responsabilidade do chamador — o handoff
 * §10.5 diz que a pílula simplesmente não é renderizada, nunca um "0" de mentira.
 */
export function TagDelta({
  valor,
  sufixo,
  densidade = 'compacta',
  className,
}: {
  valor: number;
  /** Ex.: " vs anterior". Fica dentro da pílula, junto do número. */
  sufixo?: string;
  /**
   * A referência usa duas densidades para a mesma anatomia: `compacta` em
   * tabela e listagem (11px, 2px 8px, seta 10px) e `kpi` no cartão de
   * indicador, onde a pílula divide a linha com um número de 44px e precisa
   * de mais corpo (12px, 3px 9px, seta 11px). Medidas tiradas do bloco do
   * KpiCard em design/extracted/LIGHT.html.
   */
  densidade?: 'compacta' | 'kpi';
  className?: string;
}) {
  const positivo = valor > 0;
  const negativo = valor < 0;

  const escala =
    densidade === 'kpi'
      ? { fontSize: 12, padding: '3px 9px', seta: 11 }
      : { fontSize: 11, padding: '2px 8px', seta: 10 };

  const cor = positivo
    ? { color: 'var(--gp-success-on)', background: 'var(--gp-success-surface)' }
    : negativo
      ? { color: 'var(--gp-danger-on)', background: 'var(--gp-danger-surface)' }
      : { color: 'var(--gp-text-2)', background: 'var(--gp-surface-3)' };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap leading-none tabular-nums',
        className,
      )}
      style={{
        borderRadius: 'var(--gp-radius-pill)',
        fontSize: escala.fontSize,
        fontWeight: 600,
        padding: escala.padding,
        ...cor,
      }}
    >
      {valor !== 0 ? (
        <Icon
          name={positivo ? 'arrow_upward' : 'arrow_downward'}
          variant="filled"
          size={escala.seta}
        />
      ) : null}
      {/* Sinal explícito no positivo; o negativo já vem com o minus do toLocaleString.
          U+2212 (minus real) em vez de hífen — é o que a tipografia tabular espera. */}
      {positivo ? '+' : ''}
      {valor.toLocaleString('pt-BR').replace('-', '−')}
      {sufixo}
    </span>
  );
}

/**
 * Nível de desempenho — pílula semântica **+ rótulo textual**.
 * A cor é reforço, nunca o único canal (handoff §5 e §11 de acessibilidade).
 */
export function TagNivel({ nivel, className }: { nivel: NivelDesempenho; className?: string }) {
  const cor: Record<NivelDesempenho, React.CSSProperties> = {
    excelente: { color: 'var(--gp-success-on)', background: 'var(--gp-success-surface)' },
    mediano: { color: 'var(--gp-warning-on)', background: 'var(--gp-warning-surface)' },
    critico: { color: 'var(--gp-danger-on)', background: 'var(--gp-danger-surface)' },
  };

  return (
    <span
      className={cn('inline-flex items-center whitespace-nowrap leading-none', className)}
      style={{
        borderRadius: 'var(--gp-radius-pill)',
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 9px',
        ...cor[nivel],
      }}
    >
      {ROTULO_NIVEL[nivel]}
    </span>
  );
}

/**
 * Cobertura parcial — pílula de alerta que **sempre** carrega o `n` da amostra.
 * O handoff §9 exige o número no tooltip: sem ele a pílula vira um aviso vago,
 * e o gestor não consegue julgar o quanto desconfiar do recorte.
 */
export function TagCoberturaParcial({ n, className }: { n: number; className?: string }) {
  const titulo = `Cobertura parcial: ${n} ${n === 1 ? 'aluno participou' : 'alunos participaram'} deste recorte.`;
  return (
    <Tag variant="qualificador" title={titulo} aria-label={titulo} className={className}>
      cobertura parcial
    </Tag>
  );
}
