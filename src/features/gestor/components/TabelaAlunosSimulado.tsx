import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import {
  CabecalhoTabela,
  Celula,
  AlternadorDensidade,
  CelulaCabecalho,
  CorpoTabela,
  FONTE_MONO,
  LinhaTabela,
  Paginacao,
  RodapeTabela,
  TabelaGestor,
  TagSituacao,
  type OrdemTabela,
} from '@/features/gestor/components/tabela';
import { TRACO, formatDelta, formatNumero } from '../lib/formatters';
import type { AlunoNoSimulado } from '../api/types';

export type ColunaOrdenavel = 'semestre' | 'acertos' | 'proficiencia' | 'variacao';
type Ordem = OrdemTabela;

function valorDaColuna(aluno: AlunoNoSimulado, coluna: ColunaOrdenavel): number | null {
  if (coluna === 'semestre') return aluno.semestre;
  if (coluna === 'acertos') return aluno.acertos;
  if (coluna === 'proficiencia') return aluno.proficiencia;
  return aluno.variacao ?? null;
}

/** Ordena por coluna numérica com nulos **sempre** no fim, nas duas direções (§4.10). */
export function ordenarAlunosNoSimulado(
  alunos: AlunoNoSimulado[],
  coluna: ColunaOrdenavel,
  ordem: Ordem,
): AlunoNoSimulado[] {
  return [...alunos].sort((a, b) => {
    const va = valorDaColuna(a, coluna);
    const vb = valorDaColuna(b, coluna);
    if (va === null && vb === null) return a.nome.localeCompare(b.nome, 'pt-BR');
    if (va === null) return 1;
    if (vb === null) return -1;
    return ordem === 'desc' ? vb - va : va - vb;
  });
}

/** Ordenação das colunas por prop: mesma regra de nulos no fim, desempate por nome. */
function ordenarPorValor<T extends AlunoNoSimulado>(
  alunos: T[],
  valor: (aluno: T) => number | null,
  ordem: Ordem,
): T[] {
  return [...alunos].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null && vb === null) return a.nome.localeCompare(b.nome, 'pt-BR');
    if (va === null) return 1;
    if (vb === null) return -1;
    return ordem === 'desc' ? vb - va : va - vb;
  });
}

/**
 * Cor do nome/semestre de quem não participou (achado F1 da revisão final).
 *
 * `--gp-text-3` (`--muted-foreground`) é a atenuação padrão — mas na linha
 * SELECIONADA o fundo passa a ser `--gp-brand-surface`, hoje opaco (item A4),
 * e o par text-3/brand-surface mede 3,98:1, abaixo do mínimo AA de 4,5:1
 * (nome próprio, conteúdo primário — não decoração). `--gp-text-2` é
 * `hsl(var(--foreground) / 0.78)`; composto sobre a mesma superfície mede
 * 7,97:1 no claro e 8,81:1 no escuro — passa AA com folga nos dois temas
 * (medido: composição alfa real + fórmula WCAG 2.1, não o token isolado) e
 * mantém a linha selecionada menos intensa que um participante, que fica em
 * `--gp-text-1` independente de seleção.
 */
function corAtenuada(participou: boolean, selecionado: boolean): string {
  if (participou) return 'var(--gp-text-1)';
  return selecionado ? 'var(--gp-text-2)' : 'var(--gp-text-3)';
}

/**
 * Filtro de proficiência da tabela de alunos do simulado (decisão de produto
 * desta sessão, ajustável depois): 3 faixas sobre o score TRI já carregado
 * pela tabela — nunca uma RPC nova, o dado já está em `AlunoNoSimulado.proficiencia`.
 *
 * Faixas: proficiente a partir de 60 (mesmo corte de `PROFICIENCIA_MINIMA`,
 * `lib/regras.ts`), próximo da proficiência entre 45 (inclusive) e 60
 * (exclusive), não proficiente abaixo de 45. Os limiares ficam locais a este
 * arquivo — a régua de `lib/regras.ts` só define o corte ÚNICO de
 * "proficiente", nunca a faixa intermediária.
 */
export type FiltroProficiencia = 'proficiente' | 'proximo' | 'nao_proficiente';

const LIMIAR_PROFICIENTE = 60;
const LIMIAR_PROXIMO_MIN = 45;

const ROTULO_PROFICIENCIA: Record<FiltroProficiencia, string> = {
  proficiente: 'Proficiente',
  proximo: 'Próximo da proficiência',
  nao_proficiente: 'Não proficiente',
};

/**
 * Mesma paleta semântica de `TagNivel`/`CascataDiagnostico` (sucesso/aviso/
 * perigo) para as 3 faixas — não é um capricho: é o mesmo conceito de
 * "quão perto da meta" que o resto do portal já pinta com essas 3 cores.
 */
const COR_PROFICIENCIA: Record<FiltroProficiencia, string> = {
  proficiente: 'var(--gp-success)',
  proximo: 'var(--gp-warning)',
  nao_proficiente: 'var(--gp-danger)',
};

/**
 * Classifica UM score TRI numa das 3 faixas. `null` (aluno sem nota — não
 * participou ou aguardando resultado) não entra em NENHUMA faixa: não há
 * como classificar o que não foi medido, e um "Não proficiente" que incluísse
 * quem nem fez a prova confundiria ausência com desempenho baixo (§4.10).
 */
export function classificarProficiencia(proficiencia: number | null): FiltroProficiencia | null {
  if (proficiencia === null) return null;
  if (proficiencia >= LIMIAR_PROFICIENTE) return 'proficiente';
  if (proficiencia >= LIMIAR_PROXIMO_MIN) return 'proximo';
  return 'nao_proficiente';
}

const ORDEM_PROFICIENCIA: FiltroProficiencia[] = ['proficiente', 'proximo', 'nao_proficiente'];

/**
 * Chips "Todos / [3 faixas]" com contagem — mesmo estilo visual de
 * `FiltroGrupoAlunos` (`TabelaAlunos.tsx`), só a anatomia do seletor: aqui o
 * filtro é CLIENT-SIDE sobre `alunos` (já carregados pela tabela), nunca um
 * parâmetro de RPC. As contagens somam sobre TODOS os alunos do recorte,
 * não sobre a lista já filtrada — trocar de faixa não pode zerar a contagem
 * das outras.
 */
/**
 * Faixa do filtro da tabela. As 3 de proficiência do Gestor são o padrão
 * (`FAIXAS_PROFICIENCIA`); o Portal do Mentor passa as suas (corte da meta no
 * B2C, limiar 60 + potencial de virada no B2B) pela prop `faixas`.
 */
export interface FaixaAlunoSimulado<T extends AlunoNoSimulado = AlunoNoSimulado> {
  chave: string;
  rotulo: string;
  /** Cor semântica da bolinha (sucesso/aviso/perigo). */
  cor: string;
  contem: (aluno: T) => boolean;
}

const FAIXAS_PROFICIENCIA: FaixaAlunoSimulado[] = ORDEM_PROFICIENCIA.map((faixa) => ({
  chave: faixa,
  rotulo: ROTULO_PROFICIENCIA[faixa],
  cor: COR_PROFICIENCIA[faixa],
  contem: (aluno: AlunoNoSimulado) => classificarProficiencia(aluno.proficiencia) === faixa,
}));

function FiltroProficienciaAlunos<T extends AlunoNoSimulado>({
  alunos,
  faixas,
  ativo,
  onSelecionar,
  rotulo,
  totalTodos,
}: {
  alunos: T[];
  faixas: FaixaAlunoSimulado<T>[];
  ativo: string | null;
  onSelecionar: (faixa: string | null) => void;
  rotulo: string;
  /** Contagem do "Todos"; ausente = soma das faixas (Gestor). */
  totalTodos?: number;
}) {
  const porFaixa = new Map<string, number>();
  for (const aluno of alunos) {
    const faixa = faixas.find((f) => f.contem(aluno));
    if (!faixa) continue;
    porFaixa.set(faixa.chave, (porFaixa.get(faixa.chave) ?? 0) + 1);
  }
  const totalClassificado = totalTodos ?? faixas.reduce((soma, faixa) => soma + (porFaixa.get(faixa.chave) ?? 0), 0);

  /**
   * Anatomia de SEGMENTED CONTROL, e não de 4 chips soltos: as quatro opções
   * são mutuamente exclusivas (é um único recorte por vez), e quatro pílulas
   * de borda igual em cinza não diziam isso — pareciam quatro etiquetas
   * independentes. Numa trilha só, com a opção ativa em superfície elevada, o
   * "um de quatro" fica na forma, e a contagem ganha um selo próprio em vez
   * de flutuar colada ao rótulo.
   */
  const Opcao = ({
    selecionado,
    rotulo,
    contagem,
    corBolinha,
    onClick,
  }: {
    selecionado: boolean;
    rotulo: string;
    contagem: number;
    corBolinha?: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      aria-pressed={selecionado}
      onClick={onClick}
      className={cn(
        'group/opcao inline-flex min-w-0 items-center gap-2 rounded-[10px] px-2.5 py-1.5',
        // Comportamento 13 (spec de motion, Parte IV §11): `scale(0.96)` no
        // press, 80ms — mesma implementação de `TabelaAlunos.tsx`.
        'transition-[color,background-color,box-shadow,transform] active:scale-[0.96]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      style={{
        fontSize: 12,
        fontWeight: selecionado ? 600 : 500,
        color: selecionado ? 'var(--gp-text-1)' : 'var(--gp-text-2)',
        background: selecionado ? 'var(--gp-surface-1)' : 'transparent',
        boxShadow: selecionado ? 'var(--gp-shadow-card)' : 'none',
        transitionDuration:
          'var(--gp-motion-3), var(--gp-motion-3), var(--gp-motion-3), var(--gp-motion-1)',
        transitionTimingFunction: 'var(--gp-ease)',
      }}
    >
      {corBolinha ? (
        <span
          aria-hidden="true"
          className="h-2 w-2 flex-none rounded-full"
          style={{
            background: corBolinha,
            // O semáforo só fica saturado na opção ativa: com as quatro em
            // cor cheia, a trilha virava um arco-íris e nenhuma cor pesava.
            opacity: selecionado ? 1 : 0.55,
          }}
        />
      ) : null}
      <span className="truncate">{rotulo}</span>
      <span
        aria-hidden="true"
        className="flex-none rounded-md px-1.5"
        style={{
          fontFamily: FONTE_MONO,
          fontVariantNumeric: 'tabular-nums',
          fontSize: 11,
          lineHeight: '16px',
          color: selecionado ? 'var(--gp-text-1)' : 'var(--gp-text-3)',
          background: selecionado ? 'var(--gp-surface-2)' : 'transparent',
        }}
      >
        {contagem}
      </span>
      {/* Contagem legível por leitor de tela sem o selo virar rótulo do botão. */}
      <span className="sr-only">{contagem}</span>
    </button>
  );

  return (
    <div
      role="group"
      aria-label={rotulo}
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl p-1"
      style={{
        background: 'var(--gp-surface-2)',
        border: '1px solid var(--gp-border-strong)',
      }}
      data-testid="filtro-proficiencia-alunos"
    >
      <Opcao
        selecionado={ativo === null}
        rotulo="Todos"
        contagem={totalClassificado}
        onClick={() => onSelecionar(null)}
      />
      <span aria-hidden="true" className="h-4 w-px" style={{ background: 'var(--gp-border-strong)' }} />
      {faixas.map((faixa) => (
        <Opcao
          key={faixa.chave}
          selecionado={ativo === faixa.chave}
          rotulo={faixa.rotulo}
          contagem={porFaixa.get(faixa.chave) ?? 0}
          corBolinha={faixa.cor}
          onClick={() => onSelecionar(ativo === faixa.chave ? null : faixa.chave)}
        />
      ))}
    </div>
  );
}


/**
 * Coluna da tabela (depois de "Aluno", que é fixa). Sem a prop `colunas`, a
 * tabela usa as do Gestor (Semestre · Número de acertos · Proficiência ·
 * Situação · Variação).
 */
export interface ColunaAlunoSimulado<T extends AlunoNoSimulado = AlunoNoSimulado> {
  id: string;
  rotulo: string;
  numerica?: boolean;
  valor: (aluno: T) => React.ReactNode;
  /** Valor ausente (traço em `--gp-text-3`). */
  ausente?: (aluno: T) => boolean;
  /** Presente = coluna ordenável por este número (nulos sempre no fim). */
  ordenarPor?: (aluno: T) => number | null;
}

export interface TabelaAlunosSimuladoProps<T extends AlunoNoSimulado = AlunoNoSimulado> {
  alunos: T[];
  multiSimulado: boolean;
  /**
   * Nome do simulado que serve de BASE da coluna "Variação" — o penúltimo do
   * recorte, já que a RPC compara sempre o mais recente com o anterior.
   * Só é usado com `multiSimulado`; `undefined` quando o chamador não sabe (a
   * célula então mostra só o delta, nunca uma base inventada).
   */
  simuladoBase?: string | null;
  pageSize?: number;
  alunoSelecionadoId?: string | null;
  onSelecionarAluno?: (id: string) => void;
  /** Colunas no lugar das do Gestor (Portal do Mentor). */
  colunas?: ColunaAlunoSimulado<T>[];
  /** Faixas do filtro no lugar das 3 de proficiência (Portal do Mentor). */
  faixas?: FaixaAlunoSimulado<T>[];
  /** Rótulo acessível do filtro de faixas. Padrão: "Filtrar alunos por proficiência". */
  rotuloFaixas?: string;
  /** Ordenação de abertura (id de coluna). Padrão: proficiência desc. */
  ordenacaoInicial?: { coluna: string; ordem: Ordem };
  /** `true` = abre com "Ocultar não participantes" ligado. */
  ocultarNaoParticipantesInicial?: boolean;
}

/**
 * Visão de alunos de um simulado (handoff §4.7 e §6). Mesma anatomia de tabela
 * da Visão Geral — as duas eram implementações independentes, com ícone de
 * ordenação, densidade e rodapé diferentes para o mesmo papel.
 *
 * A tabela abre JÁ ORDENADA por proficiência descendente: a referência mostra
 * um critério vigente no cabeçalho, e abrir na ordem crua do array não é
 * ordem nenhuma — é a ordem que a RPC devolveu, que o gestor não tem como
 * inferir.
 */
/**
 * Chave de busca: sem acento e em minúsculas, para "jose" achar "JOSÉ". A
 * comparação é por trecho em qualquer posição do nome — gestor digita sobrenome
 * tanto quanto primeiro nome.
 */
function normalizarBusca(texto: string): string {
  return (texto ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function TabelaAlunosSimulado<T extends AlunoNoSimulado = AlunoNoSimulado>({
  alunos,
  multiSimulado,
  simuladoBase,
  pageSize = 20,
  alunoSelecionadoId = null,
  onSelecionarAluno,
  colunas,
  faixas,
  rotuloFaixas = 'Filtrar alunos por proficiência',
  ordenacaoInicial,
  ocultarNaoParticipantesInicial = false,
}: TabelaAlunosSimuladoProps<T>) {
  const [ordenacao, setOrdenacao] = React.useState<{ coluna: string; ordem: Ordem }>(
    ordenacaoInicial ?? { coluna: 'proficiencia', ordem: 'desc' },
  );
  const [ocultarNaoParticipantes, setOcultarNaoParticipantes] = React.useState(ocultarNaoParticipantesInicial);
  const [filtroProficiencia, setFiltroProficiencia] = React.useState<string | null>(null);
  const faixasEfetivas = React.useMemo(
    () => (faixas ?? FAIXAS_PROFICIENCIA) as FaixaAlunoSimulado<T>[],
    [faixas],
  );
  const [busca, setBusca] = React.useState('');
  const [page, setPage] = React.useState(1);

  const termo = normalizarBusca(busca);

  const visiveis = React.useMemo(() => {
    let filtrados = ocultarNaoParticipantes ? alunos.filter((a) => a.participou) : alunos;
    if (filtroProficiencia !== null) {
      const faixa = faixasEfetivas.find((f) => f.chave === filtroProficiencia);
      if (faixa) filtrados = filtrados.filter((a) => faixa.contem(a));
    }
    if (termo.length > 0) {
      filtrados = filtrados.filter((a) => normalizarBusca(a.nome).includes(termo));
    }
    if (colunas) {
      const coluna = colunas.find((c) => c.id === ordenacao.coluna);
      return coluna?.ordenarPor ? ordenarPorValor(filtrados, coluna.ordenarPor, ordenacao.ordem) : filtrados;
    }
    // Ordena os mesmos objetos: o tipo da linha (T) continua o do chamador.
    return ordenarAlunosNoSimulado(filtrados, ordenacao.coluna as ColunaOrdenavel, ordenacao.ordem) as T[];
  }, [alunos, ocultarNaoParticipantes, filtroProficiencia, faixasEfetivas, termo, ordenacao, colunas]);

  /** Trocar de faixa de proficiência também volta para a página 1 — mesmo motivo de `ocultarNaoParticipantes`. */
  const selecionarProficiencia = (faixa: string | null) => {
    setFiltroProficiencia(faixa);
    setPage(1);
  };

  const buscarPor = (texto: string) => {
    setBusca(texto);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(visiveis.length / pageSize));
  const pageAtual = Math.min(page, totalPages);
  const daPagina = visiveis.slice((pageAtual - 1) * pageSize, pageAtual * pageSize);

  /**
   * Contado sobre `alunos`, nunca sobre `visiveis`: o total de quem não
   * participou é justamente o número que o filtro esconde — derivá-lo da lista
   * já filtrada o zeraria no exato momento em que ele é a informação.
   */
  const participantes = alunos.filter((a) => a.participou).length;
  const semParticipacao = alunos.length - participantes;

  const alternarOrdenacao = (coluna: string) => {
    setPage(1);
    setOrdenacao((atual) =>
      atual.coluna === coluna ? { coluna, ordem: atual.ordem === 'desc' ? 'asc' : 'desc' } : { coluna, ordem: 'desc' },
    );
  };

  const ordemDe = (coluna: string) => (ordenacao.coluna === coluna ? ordenacao.ordem : null);

  return (
    <section
      aria-label="Visão de alunos do recorte"
      className="flex flex-col gap-3.5 p-6"
      style={{
        background: 'var(--gp-surface-1)',
        border: '1px solid var(--gp-border-strong)',
        borderRadius: 16,
        boxShadow: 'var(--gp-shadow-card)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gp-text-1)' }}>Visão de alunos</h3>
        {/* Com 2+ simulados no recorte, acertos e proficiência NÃO são média:
            a consulta monta cada linha com o simulado mais recente da seleção.
            A tag diz isso na cara do gestor — sem ela, a leitura natural de um
            recorte múltiplo é "média", que seria um número que ninguém
            calculou. */}
        {multiSimulado ? (
          <span
            data-testid="tag-simulado-mais-recente"
            title="Com mais de um simulado selecionado, número de acertos e proficiência são os do simulado mais recente do recorte — não são médias."
            className="inline-flex items-center gap-1 border"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.02em',
              padding: '2px 7px',
              borderRadius: 'var(--gp-radius-pill)',
              color: 'var(--gp-text-2)',
              borderColor: 'var(--gp-border-strong)',
              background: 'var(--gp-surface-2)',
            }}
          >
            <Icon name="info" size={11} />
            simulado mais recente
          </span>
        ) : null}

        <span
          data-testid="contador-participacao"
          className="ml-auto"
          style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
        >
          {participantes} {participantes === 1 ? 'participante' : 'participantes'} · {semParticipacao} sem
          participação
        </span>
      </div>

      {/* Busca por nome: filtro client-side sobre a lista já carregada — nenhuma
          requisição nova e nenhum número recalculado (os contadores acima
          continuam falando da população do recorte). Mesmo desenho do campo da
          tabela da Visão Geral. */}
      <div
        className="flex min-w-[220px] max-w-full items-center gap-2 px-3 sm:max-w-[320px]"
        style={{
          border: '1px solid var(--gp-border-input)',
          borderRadius: 9,
          color: 'var(--gp-text-3)',
        }}
      >
        <Icon name="search" size={15} />
        <input
          type="search"
          aria-label="Buscar aluno"
          placeholder="Buscar aluno por nome…"
          value={busca}
          onChange={(evento) => buscarPor(evento.target.value)}
          className="h-8 w-full bg-transparent outline-none focus:outline-none focus-visible:outline-none focus-visible:!shadow-none"
          style={{ fontSize: 12, color: 'var(--gp-text-1)' }}
        />
      </div>

      <FiltroProficienciaAlunos
        alunos={alunos}
        faixas={faixasEfetivas}
        ativo={filtroProficiencia}
        onSelecionar={selecionarProficiencia}
        rotulo={rotuloFaixas}
        totalTodos={faixas ? participantes : undefined}
      />

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-3">
          <EstadoVazio
            titulo={
              termo.length > 0
                ? 'Nenhum aluno com essa busca'
                : ocultarNaoParticipantes || filtroProficiencia !== null
                  ? 'Nenhum aluno com esse filtro'
                  : 'Nenhum aluno neste recorte'
            }
            descricao={
              termo.length > 0
                ? ocultarNaoParticipantes || filtroProficiencia !== null
                  ? 'A busca por nome, junto com os filtros ativos, escondeu todas as linhas.'
                  : 'Nenhum nome do recorte corresponde ao texto buscado.'
                : ocultarNaoParticipantes && filtroProficiencia !== null
                  ? 'O filtro de participação e o de proficiência juntos escondem todas as linhas.'
                  : filtroProficiencia !== null
                    ? 'O filtro de proficiência escondeu todas as linhas.'
                    : ocultarNaoParticipantes
                      ? 'O filtro de participação escondeu todas as linhas.'
                      : 'Ajuste o recorte de simulados ou de semestre.'
            }
          />
          {termo.length > 0 ? (
            <button
              type="button"
              onClick={() => buscarPor('')}
              className="inline-flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-text-2)' }}
            >
              <Icon name="close" size={15} />
              Limpar busca
            </button>
          ) : null}
          {ocultarNaoParticipantes ? (
            <button
              type="button"
              onClick={() => {
                setOcultarNaoParticipantes(false);
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-text-2)' }}
            >
              <Icon name="visibility" size={15} />
              Mostrar não participantes
            </button>
          ) : null}
          {filtroProficiencia !== null ? (
            <button
              type="button"
              onClick={() => selecionarProficiencia(null)}
              className="inline-flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-text-2)' }}
            >
              <Icon name="visibility" size={15} />
              Mostrar todas as faixas de proficiência
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <TabelaGestor rotulo="Alunos do simulado">
            <CabecalhoTabela>
              <tr>
                <CelulaCabecalho>Aluno</CelulaCabecalho>
                {colunas ? (
                  colunas.map((coluna) => (
                    <CelulaCabecalho
                      key={coluna.id}
                      numerica={coluna.numerica}
                      ordem={coluna.ordenarPor ? ordemDe(coluna.id) : undefined}
                      onOrdenar={coluna.ordenarPor ? () => alternarOrdenacao(coluna.id) : undefined}
                    >
                      {coluna.rotulo}
                    </CelulaCabecalho>
                  ))
                ) : (
                <>
                <CelulaCabecalho numerica ordem={ordemDe('semestre')} onOrdenar={() => alternarOrdenacao('semestre')}>
                  Semestre
                </CelulaCabecalho>
                <CelulaCabecalho numerica ordem={ordemDe('acertos')} onOrdenar={() => alternarOrdenacao('acertos')}>
                  Número de acertos
                </CelulaCabecalho>
                <CelulaCabecalho
                  numerica
                  ordem={ordemDe('proficiencia')}
                  onOrdenar={() => alternarOrdenacao('proficiencia')}
                >
                  Proficiência
                </CelulaCabecalho>
                <CelulaCabecalho>Situação</CelulaCabecalho>
                {multiSimulado && (
                  <CelulaCabecalho numerica ordem={ordemDe('variacao')} onOrdenar={() => alternarOrdenacao('variacao')}>
                    Variação
                  </CelulaCabecalho>
                )}
                </>
                )}
              </tr>
            </CabecalhoTabela>
            <CorpoTabela>
              {daPagina.map((a, indice) => {
                const selecionado = a.id === alunoSelecionadoId;
                return (
                  <LinhaTabela
                    key={a.id}
                    data-testid={`linha-aluno-${a.id}`}
                    data-selecionado={String(selecionado)}
                    selecionada={selecionado}
                    ultima={indice === daPagina.length - 1}
                    onSelecionar={onSelecionarAluno ? () => onSelecionarAluno(a.id) : undefined}
                  >
                    <Celula marcada={selecionado}>
                      {/* A linha inteira abre o aluno no clique; este botão é o
                          alvo de TECLADO, um só por linha. */}
                      <span data-testid="celula-nome">
                        {onSelecionarAluno ? (
                          <button
                            type="button"
                            title={a.nome}
                            onClick={() => onSelecionarAluno(a.id)}
                            className="block max-w-[220px] truncate text-left"
                            style={{
                              color: corAtenuada(a.participou, selecionado),
                              fontWeight: selecionado ? 600 : 400,
                            }}
                          >
                            {a.nome}
                          </button>
                        ) : (
                          <span
                            title={a.nome}
                            className="block max-w-[220px] truncate"
                            style={{
                              color: corAtenuada(a.participou, selecionado),
                              fontWeight: selecionado ? 600 : 400,
                            }}
                          >
                            {a.nome}
                          </span>
                        )}
                      </span>
                    </Celula>
                    {colunas ? (
                      colunas.map((coluna) => (
                        <Celula
                          key={coluna.id}
                          numerica={coluna.numerica}
                          ausente={coluna.ausente?.(a) ?? false}
                          data-testid={`celula-${coluna.id}`}
                        >
                          {coluna.valor(a)}
                        </Celula>
                      ))
                    ) : (
                    <>
                    <Celula
                      numerica
                      ausente={a.semestre === null || !a.participou}
                      // Mesmo achado F1: na linha selecionada, `ausente` pintaria
                      // este `—`/semestre em `--gp-text-3` sobre `--gp-brand-surface`
                      // (3,98:1, sub-AA) exatamente pelo NÃO PARTICIPOU — não pela
                      // ausência real do dado. Sobrescreve só nesse caso; a
                      // ausência genuína (semestre nulo de quem participou)
                      // continua em text-3, sem relação com este achado.
                      style={selecionado && !a.participou ? { color: 'var(--gp-text-2)' } : undefined}
                    >
                      {a.semestre === null ? TRACO : `${a.semestre}º`}
                    </Celula>
                    <Celula numerica ausente={a.acertos === null} data-testid="celula-acertos">
                      {formatNumero(a.acertos)}
                    </Celula>
                    <Celula numerica ausente={a.proficiencia === null} data-testid="celula-proficiencia">
                      {formatNumero(a.proficiencia)}
                    </Celula>
                    <Celula>
                      <TagSituacao situacao={a.situacao} />
                    </Celula>
                    {multiSimulado && (
                      <Celula
                        numerica
                        ausente={(a.variacao ?? null) === null}
                        data-testid="celula-variacao"
                      >
                        {formatDelta(a.variacao ?? null)}
                        {/* A base da comparação nomeada na própria célula
                            ("+6,6 (vs 3º Simulado FAI)"): sem ela, "variação"
                            num recorte de vários simulados não diz contra o
                            quê. Só aparece quando existe delta E o chamador
                            sabe qual é o simulado anterior. */}
                        {(a.variacao ?? null) !== null && simuladoBase ? (
                          <span
                            data-testid="base-variacao"
                            className="ml-1 whitespace-nowrap"
                            style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--gp-text-3)' }}
                          >
                            (vs {simuladoBase})
                          </span>
                        ) : null}
                      </Celula>
                    )}
                    </>
                    )}

                  </LinhaTabela>
                );
              })}
            </CorpoTabela>
          </TabelaGestor>

          <RodapeTabela>
            {/* A ação vive no rodapé, à esquerda, como a referência — era um
                Switch do Radix no cabeçalho, do outro lado do card. */}
            <button
              type="button"
              aria-pressed={ocultarNaoParticipantes}
              onClick={() => {
                setOcultarNaoParticipantes((atual) => !atual);
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5"
              style={{ color: 'var(--gp-text-2)' }}
            >
              <Icon name="visibility_off" size={15} />
              Ocultar não participantes
            </button>
            <span
              data-testid="contador-linhas"
              style={{ fontFamily: FONTE_MONO, fontVariantNumeric: 'tabular-nums' }}
            >
              Mostrando {daPagina.length} de {visiveis.length}
            </span>
            {/* Onda 4: densidade também aqui, encostada na paginação — é a
                mesma decisão ("cabe mais linha na tela?") e a escolha é
                compartilhada com a tabela da Visão de Alunos. */}
            <AlternadorDensidade className="ml-auto" />
            <Paginacao
              rotulo="Paginação de alunos do simulado"
              page={pageAtual}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </RodapeTabela>
        </>
      )}
    </section>
  );
}
