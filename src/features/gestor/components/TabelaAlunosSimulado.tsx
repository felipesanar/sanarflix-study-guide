import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import {
  CabecalhoTabela,
  Celula,
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

export interface TabelaAlunosSimuladoProps {
  alunos: AlunoNoSimulado[];
  multiSimulado: boolean;
  pageSize?: number;
  alunoSelecionadoId?: string | null;
  onSelecionarAluno?: (id: string) => void;
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
export function TabelaAlunosSimulado({
  alunos,
  multiSimulado,
  pageSize = 20,
  alunoSelecionadoId = null,
  onSelecionarAluno,
}: TabelaAlunosSimuladoProps) {
  const [ordenacao, setOrdenacao] = React.useState<{ coluna: ColunaOrdenavel; ordem: Ordem }>({
    coluna: 'proficiencia',
    ordem: 'desc',
  });
  const [ocultarNaoParticipantes, setOcultarNaoParticipantes] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const visiveis = React.useMemo(() => {
    const filtrados = ocultarNaoParticipantes ? alunos.filter((a) => a.participou) : alunos;
    return ordenarAlunosNoSimulado(filtrados, ordenacao.coluna, ordenacao.ordem);
  }, [alunos, ocultarNaoParticipantes, ordenacao]);

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

  const alternarOrdenacao = (coluna: ColunaOrdenavel) => {
    setPage(1);
    setOrdenacao((atual) =>
      atual.coluna === coluna ? { coluna, ordem: atual.ordem === 'desc' ? 'asc' : 'desc' } : { coluna, ordem: 'desc' },
    );
  };

  const ordemDe = (coluna: ColunaOrdenavel) => (ordenacao.coluna === coluna ? ordenacao.ordem : null);

  const colunas = multiSimulado ? 6 : 5;

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
        <span
          data-testid="contador-participacao"
          className="ml-auto"
          style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
        >
          {participantes} {participantes === 1 ? 'participante' : 'participantes'} · {semParticipacao} sem
          participação
        </span>
      </div>

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-3">
          <EstadoVazio
            titulo={
              ocultarNaoParticipantes
                ? 'Nenhum aluno participou deste recorte'
                : 'Nenhum aluno neste recorte'
            }
            descricao={
              ocultarNaoParticipantes
                ? 'O filtro de participação escondeu todas as linhas.'
                : 'Ajuste o recorte de simulados ou de semestre.'
            }
          />
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
        </div>
      ) : (
        <>
          <TabelaGestor rotulo="Alunos do simulado">
            <CabecalhoTabela>
              <tr>
                <CelulaCabecalho>Aluno</CelulaCabecalho>
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
                      </Celula>
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
            <Paginacao
              className="ml-auto"
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
