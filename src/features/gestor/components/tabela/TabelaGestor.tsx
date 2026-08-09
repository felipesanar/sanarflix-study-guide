import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import { PADDING_DENSIDADE, useDensidadeTabela } from './densidade';

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
  /**
   * Clique na linha inteira. Recebe o evento porque quem tem um controle
   * PRÓPRIO dentro da linha (o disclosure de `TabelaQuestoes`, por exemplo)
   * precisa distinguir o clique nele do clique na linha — senão o mesmo gesto
   * dispara os dois handlers e o estado abre e fecha no mesmo instante.
   */
  onSelecionar?: (evento: React.MouseEvent<HTMLTableRowElement>) => void;
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
      className={cn(
        // `gp-hover-surface` (gestor-theme.css) é o único hover do repositório
        // com a curva do handoff, e no escuro CLAREIA. Não se aplica à linha
        // selecionada: o tint de marca perderia para o tint de hover.
        !selecionada && onSelecionar && 'gp-hover-surface',
        onSelecionar && 'cursor-pointer',
        // Comportamento 10 (spec de motion, Parte IV §11): anel de foco
        // INTERNO em qualquer controle focável dentro da linha — o anel
        // externo padrão (`.gestor-portal :focus-visible`, `--gp-focus-ring`)
        // pode ser cortado pela borda da célula ou pelo `overflow-x: auto` da
        // moldura da tabela (`TabelaGestor`). Sintaxe de propriedade explícita
        // (`[box-shadow:...]`), nunca a utilidade curta do Tailwind com um
        // valor arbitrário que comece só por `var(`: guard de `tema.test.tsx`
        // reprova esse padrão ambíguo, que resolveria para `--tw-shadow-color`
        // em vez do box-shadow inteiro.
        '[&_:focus-visible]:[box-shadow:inset_0_0_0_2px_var(--gp-brand)] [&_:focus-visible]:outline-none',
        className,
      )}
      style={{
        borderBottom: ultima ? undefined : '1px solid var(--gp-border-subtle)',
        // Token dedicado à linha selecionada (gestor-theme.css §"Superfície de
        // marca mais suave") — `--gp-brand-surface` (opaco, item A4) é para
        // outros usos; a tabela nunca o consumiu até aqui.
        background: selecionada ? 'var(--gp-brand-surface-soft)' : undefined,
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
  const densidade = useDensidadeTabela();
  const alinhamento = numerica ? 'right' : 'left';
  const estilo: React.CSSProperties = {
    ...ESTILO_CABECALHO,
    padding: PADDING_DENSIDADE[densidade].cabecalho,
    textAlign: alinhamento,
    width: largura,
  };

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
   * Primeira célula da linha selecionada: recebe a barra de marca (comportamento
   * 16, Parte IV §11 da spec de motion). Nunca desloca o texto — ver comentário
   * da barra abaixo.
   */
  marcada?: boolean;
}

/**
 * Barra de 3px da linha selecionada, animada (comportamento 16): CRESCE por
 * `scaleY(0 → 1)` a partir do centro em 200ms (`--gp-motion-3`/`--gp-ease`),
 * nunca aparece de repente. Antes era um `border-left` estático — que também
 * exigia compensar o `padding-left` (12px→9px) para o texto não deslocar.
 * Como elemento absoluto sobreposto (não ocupa espaço no box), o padding da
 * célula fica constante e a barra nunca desloca layout (regra de movimento:
 * só `transform`/`opacity`, nunca `width`/`padding`).
 *
 * Renderizado em TODA `Celula` (não só a `marcada`) para a transição
 * funcionar de verdade: uma transição CSS não roda em elemento que nunca
 * existiu antes (mesmo motivo do comportamento 17, `SeletorSimulados.tsx`) —
 * com `scaleY(0)` em repouso, a barra é invisível e o custo extra de DOM é
 * uma `<span>` de 0 altura visual por célula.
 */
function BarraSelecao({ marcada }: { marcada: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-testid="barra-selecao"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: 'var(--gp-brand)',
        transformOrigin: 'center',
        transform: marcada ? 'scaleY(1)' : 'scaleY(0)',
        transitionProperty: 'transform',
        transitionDuration: 'var(--gp-motion-3)',
        transitionTimingFunction: 'var(--gp-ease)',
      }}
    />
  );
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
  const densidade = useDensidadeTabela();
  return (
    <td
      {...rest}
      className={className}
      data-marca-selecao={marcada ? 'true' : undefined}
      style={{
        ...ESTILO_CELULA,
        padding: PADDING_DENSIDADE[densidade].celula,
        textAlign: numerica ? 'right' : 'left',
        fontFamily: numerica ? FONTE_MONO : undefined,
        fontVariantNumeric: numerica ? 'tabular-nums' : undefined,
        color: ausente ? 'var(--gp-text-3)' : ESTILO_CELULA.color,
        position: 'relative',
        ...style,
      }}
    >
      <BarraSelecao marcada={marcada} />
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
