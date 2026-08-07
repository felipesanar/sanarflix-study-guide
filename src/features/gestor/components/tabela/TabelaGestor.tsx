import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';

/**
 * Anatomia única de tabela do Portal do Gestor — handoff §6.
 *
 * Existe porque as duas tabelas de aluno nasceram como implementações
 * independentes (ícone de ordenação diferente, rodapé diferente, densidade
 * diferente) e a referência desenha UMA tabela só. Aqui mora a régua:
 * cabeçalho 10px/600 uppercase 0.04em sobre divisor FORTE, célula 11px 12px /
 * 12px sobre divisor SUTIL, número à direita em mono tabular, ausência em
 * text-3, seleção com tint de marca + barra de 3px na primeira célula.
 *
 * Por que não `@/components/ui/table`: aquele primitivo é compartilhado com
 * aluno e admin (`h-12 px-4`, `text-sm`, mesma cor de borda no thead e no
 * tbody). Densificar por lá mudaria as tabelas dos outros dois produtos; e
 * sobrescrever célula a célula com utilitário foi exatamente como a
 * divergência apareceu. A semântica de `<table>` real é preservada — os
 * papéis `table`/`rowgroup`/`row`/`columnheader`/`cell` que a a11y (e os
 * testes) exigem continuam vindo dos elementos nativos.
 */

/**
 * Família mono das tabelas (handoff §3 de tipografia: "números em tabela em
 * Roboto Mono"). Escrita aqui como constante, e não como `var(--gp-font-mono)`,
 * porque a fonte não é carregada pelo app — usar a variável deixaria toda
 * célula numérica sem família nenhuma se o carregamento falhar. Enquanto
 * Roboto Mono não sobe via `<link>`/`@font-face`, a cadeia cai na mono do
 * sistema, que já dá o alinhamento tabular que a coluna precisa.
 */
export const FONTE_MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, monospace";

export type OrdemTabela = 'asc' | 'desc';

const ESTILO_CABECALHO: React.CSSProperties = {
  padding: '9px 12px',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--gp-text-3)',
  borderBottom: '1px solid var(--gp-border-strong)',
  whiteSpace: 'nowrap',
};

const ESTILO_CELULA: React.CSSProperties = {
  padding: '11px 12px',
  fontSize: 12,
  color: 'var(--gp-text-1)',
  verticalAlign: 'middle',
};

/** Moldura + `<table>`. O scroll horizontal fica na moldura, nunca no corpo da página. */
export function TabelaGestor({
  children,
  rotulo,
  className,
}: {
  children: React.ReactNode;
  /** Vai para `aria-label` da tabela — toda tabela precisa de nome acessível. */
  rotulo: string;
  className?: string;
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table aria-label={rotulo} className="w-full" style={{ borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  );
}

export function CabecalhoTabela({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>;
}

export function CorpoTabela({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export interface LinhaTabelaProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selecionada?: boolean;
  /** A última linha do corpo não desenha divisor (handoff §6). */
  ultima?: boolean;
  /**
   * Clique em QUALQUER célula abre o registro. Fica só no mouse de propósito:
   * o alvo de teclado é o botão do nome, dentro da primeira célula. Pôr
   * `role="button"`/`tabIndex` na linha criaria um segundo tab stop por linha
   * e um `nested-interactive` de axe (botão focável dentro de botão).
   */
  onSelecionar?: () => void;
}

export function LinhaTabela({
  selecionada = false,
  ultima = false,
  onSelecionar,
  className,
  style,
  children,
  ...rest
}: LinhaTabelaProps) {
  return (
    <tr
      {...rest}
      onClick={onSelecionar}
      // `gp-hover-surface` (gestor-theme.css) é o único hover do repositório
      // com a curva do handoff, e no escuro CLAREIA. Não se aplica à linha
      // selecionada: o tint de marca perderia para o tint de hover.
      className={cn(!selecionada && onSelecionar && 'gp-hover-surface', onSelecionar && 'cursor-pointer', className)}
      style={{
        borderBottom: ultima ? undefined : '1px solid var(--gp-border-subtle)',
        background: selecionada ? 'var(--gp-brand-surface)' : undefined,
        ...style,
      }}
    >
      {children}
    </tr>
  );
}

export interface CelulaCabecalhoProps {
  children: React.ReactNode;
  /** Número: alinha à direita, como toda coluna numérica das tabelas. */
  numerica?: boolean;
  /** Ordenação vigente DESTA coluna; `undefined` quando a coluna não ordena. */
  ordem?: OrdemTabela | null;
  onOrdenar?: () => void;
  largura?: number | string;
}

export function CelulaCabecalho({
  children,
  numerica = false,
  ordem,
  onOrdenar,
  largura,
}: CelulaCabecalhoProps) {
  const alinhamento = numerica ? 'right' : 'left';
  const estilo: React.CSSProperties = { ...ESTILO_CABECALHO, textAlign: alinhamento, width: largura };

  if (!onOrdenar) {
    return (
      <th scope="col" style={estilo}>
        {children}
      </th>
    );
  }

  const ariaSort = ordem === 'asc' ? 'ascending' : ordem === 'desc' ? 'descending' : 'none';

  return (
    <th scope="col" aria-sort={ariaSort} style={estilo}>
      <button
        type="button"
        onClick={onOrdenar}
        className="inline-flex w-full items-center gap-1"
        style={{
          font: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
          color: 'inherit',
          justifyContent: numerica ? 'flex-end' : 'flex-start',
        }}
      >
        {children}
        {ordem ? (
          <Icon name={ordem === 'desc' ? 'arrow_downward' : 'arrow_upward'} variant="filled" size={10} />
        ) : null}
      </button>
    </th>
  );
}

export interface CelulaProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numerica?: boolean;
  /** Valor ausente: o `—` vai em text-3, nunca na cor do dado. */
  ausente?: boolean;
  /**
   * Primeira célula da linha selecionada: recebe a barra de 3px da marca, com
   * o padding-left compensado de 12px para 9px para o texto não deslocar.
   */
  marcada?: boolean;
}

export function Celula({
  numerica = false,
  ausente = false,
  marcada = false,
  className,
  style,
  children,
  ...rest
}: CelulaProps) {
  return (
    <td
      {...rest}
      className={className}
      data-marca-selecao={marcada ? 'true' : undefined}
      style={{
        ...ESTILO_CELULA,
        textAlign: numerica ? 'right' : 'left',
        fontFamily: numerica ? FONTE_MONO : undefined,
        fontVariantNumeric: numerica ? 'tabular-nums' : undefined,
        color: ausente ? 'var(--gp-text-3)' : ESTILO_CELULA.color,
        ...(marcada
          ? { borderLeft: '3px solid var(--gp-brand)', paddingLeft: 9 }
          : null),
        ...style,
      }}
    >
      {children}
    </td>
  );
}

/**
 * Corpo em carregamento: 5 linhas de esqueleto (docs/12) COM o cabeçalho
 * mantido montado — trocar a tabela inteira por retângulos faz o cabeçalho
 * sumir e voltar, e o bloco saltar de altura.
 *
 * As linhas são `aria-hidden`: quem anuncia o carregamento é o `role="status"`
 * que o consumidor renderiza ao lado, uma vez — cinco anúncios seriam cinco
 * interrupções do leitor de tela para o mesmo fato.
 */
export function LinhasSkeleton({ colunas, linhas = 5 }: { colunas: number; linhas?: number }) {
  return (
    <>
      {Array.from({ length: linhas }, (_, i) => (
        <tr key={i} aria-hidden="true" style={{ borderBottom: '1px solid var(--gp-border-subtle)' }}>
          <td colSpan={colunas} style={ESTILO_CELULA}>
            <div className="gp-skeleton animate-pulse" style={{ height: 18 }} />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Faixa de rodapé do card: divisor no topo, ação/contagem à esquerda e
 * paginação empurrada para a direita (handoff §6). Uma só forma para as duas
 * tabelas — antes eram três rodapés diferentes para o mesmo papel.
 */
export function RodapeTabela({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3', className)}
      style={{
        borderTop: '1px solid var(--gp-border-subtle)',
        paddingTop: 12,
        fontSize: 12,
        color: 'var(--gp-text-3)',
      }}
    >
      {children}
    </div>
  );
}
