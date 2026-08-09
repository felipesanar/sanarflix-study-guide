import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';

/**
 * Paginação única das tabelas do gestor — handoff §6 e docs/04 §7
 * ("Primeira, anterior, páginas, próxima; página atual com alto contraste;
 * alvo mínimo 30px").
 *
 * Antes cada tabela tinha só "Anterior"/"Próxima": com 104 alunos a 25 por
 * página, a última página ficava a quatro cliques, e não havia como saber em
 * qual das páginas se está sem ler a frase ao lado. Aqui os números são o
 * controle, e a página atual é a única em alto contraste.
 */

/**
 * Janela de páginas com elipse: sempre a primeira e a última, mais uma
 * vizinhança da atual. Exportada para teste — a aritmética de janela é o tipo
 * de coisa que quebra em silêncio nas bordas (página 1 e última página).
 */
export function paginasVisiveis(atual: number, total: number): (number | 'reticencias')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const inicio = Math.max(2, Math.min(atual - 1, total - 3));
  const fim = Math.min(total - 1, Math.max(atual + 1, 3));

  const paginas: (number | 'reticencias')[] = [1];
  if (inicio > 2) paginas.push('reticencias');
  for (let p = inicio; p <= fim; p += 1) paginas.push(p);
  if (fim < total - 1) paginas.push('reticencias');
  paginas.push(total);
  return paginas;
}

const CAIXA: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 7,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  flex: 'none',
};

function estiloBotao(estado: 'normal' | 'atual' | 'desabilitado'): React.CSSProperties {
  if (estado === 'atual') {
    return {
      ...CAIXA,
      // Alto contraste nos dois temas sem hex: no claro `text-1` é escuro
      // sobre `surface-1` claro; no escuro os dois invertem junto com o tema.
      border: '1px solid var(--gp-text-1)',
      background: 'var(--gp-text-1)',
      color: 'var(--gp-surface-1)',
      fontWeight: 700,
    };
  }
  return {
    ...CAIXA,
    border: '1px solid var(--gp-border-strong)',
    color: estado === 'desabilitado' ? 'var(--gp-border-input)' : 'var(--gp-text-2)',
  };
}

export interface PaginacaoProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Nome acessível da navegação, ex.: "Paginação de alunos". */
  rotulo: string;
  className?: string;
  /**
   * Prefetch no hover do botão "Próxima página" (spec de motion, Parte
   * VIII §22: "hover na página seguinte da paginação → prefetch daquela
   * página"). Recebe a página que o hover aquece (`atual + 1`) — quem chama
   * decide QUAL query aquecer (ex.: `prefetchProximaPaginaAlunos`), porque
   * `Paginacao` é compartilhado por três tabelas com RPCs diferentes
   * (`TabelaAlunos`, `TabelaAlunosSimulado`, `TabelaQuestoes`) e não deveria
   * conhecer nenhuma delas. Opcional e sem efeito em quem não passa —
   * `TabelaAlunosSimulado`/`TabelaQuestoes` continuam sem prefetch de página.
   */
  onHoverProximaPagina?: (proximaPagina: number) => void;
}

export function Paginacao({
  page,
  totalPages,
  onPageChange,
  rotulo,
  className,
  onHoverProximaPagina,
}: PaginacaoProps) {
  const total = Math.max(1, totalPages);
  const atual = Math.min(Math.max(1, page), total);
  const naPrimeira = atual <= 1;
  const naUltima = atual >= total;

  return (
    <nav aria-label={rotulo} className={cn('flex items-center gap-1.5', className)}>
      <button
        type="button"
        aria-label="Página anterior"
        disabled={naPrimeira}
        onClick={() => onPageChange(atual - 1)}
        style={estiloBotao(naPrimeira ? 'desabilitado' : 'normal')}
      >
        <Icon name="chevron_left" size={16} />
      </button>

      {paginasVisiveis(atual, total).map((p, i) =>
        p === 'reticencias' ? (
          <span key={`reticencias-${i}`} aria-hidden="true" style={{ color: 'var(--gp-text-3)' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Página ${p}`}
            aria-current={p === atual ? 'page' : undefined}
            onClick={() => onPageChange(p)}
            style={estiloBotao(p === atual ? 'atual' : 'normal')}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Próxima página"
        disabled={naUltima}
        onClick={() => onPageChange(atual + 1)}
        onMouseEnter={naUltima ? undefined : () => onHoverProximaPagina?.(atual + 1)}
        style={estiloBotao(naUltima ? 'desabilitado' : 'normal')}
      >
        <Icon name="chevron_right" size={16} />
      </button>
    </nav>
  );
}
