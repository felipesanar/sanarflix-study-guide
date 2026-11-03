import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/features/gestor/components/Icon';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  LinhaTabela,
  LinhasSkeleton,
  Paginacao,
  RodapeTabela,
  TabelaGestor,
} from '@/features/gestor/components/tabela';
import { buscarExportAlunos, useEngajamentoAlunos, PAGE_SIZE_ALUNOS } from '@/features/gestor/api/engajamento';
import { useGestorContexto } from '@/features/gestor/api/queries';
import type {
  AbaConsumo,
  DirecaoOrdem,
  LinhaAlunoEngajamento,
  LinhaExportAluno,
  OrdemAlunos,
} from '@/features/gestor/api/types-engajamento';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { useValorComAtraso } from '@/features/gestor/hooks/useValorComAtraso';
import { baixarCsv, nomeArquivoCsv, type ColunaCsv } from '@/features/gestor/lib/exportarCsv';
import { rotuloRecencia, slugIes } from '@/features/gestor/lib/engajamento';
import { formatData, formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';

/** Recência a partir da qual a "Última atividade" vira alerta (§12.2). */
const DIAS_ALERTA_RECENCIA = 14;

export interface TabelaPorAlunoProps {
  filtros: FiltrosEngajamento;
  /** Aba de consumo selecionada: só realça as colunas dela; quem ordena é o cabeçalho. */
  aba: AbaConsumo;
  /** Estado do filtro "Sem atividade há 14 dias": vive no pai (Quem não voltou também o liga). */
  sem14: boolean;
  onSem14Change: (valor: boolean) => void;
  /** Slug-fonte do nome do arquivo de exportação. */
  iesNome: string;
  /** Abre o drawer do aluno (B7). */
  onAbrirDetalhes: (alunoId: string) => void;
}

const COLUNAS_DA_ABA: Record<AbaConsumo, Array<'questoes' | 'acerto' | 'videos' | 'documentos'>> = {
  questoes: ['questoes', 'acerto'],
  videos: ['videos'],
  documentos: ['documentos'],
};

/** Ordenação inicial: a mesma de antes da ordenação por cabeçalho (mais questões primeiro). */
const ORDENACAO_INICIAL: { coluna: OrdemAlunos; direcao: DirecaoOrdem } = { coluna: 'questoes', direcao: 'desc' };

/** Direção do primeiro clique numa coluna: texto e semestre crescem; consumo e recência, do maior/mais recente. */
const DIRECAO_PADRAO: Record<OrdemAlunos, DirecaoOrdem> = {
  nome: 'asc',
  semestre: 'asc',
  questoes: 'desc',
  acerto: 'desc',
  videos: 'desc',
  documentos: 'desc',
  ultima_atividade: 'desc',
};

const alertaRecencia = (dias: number | null) => dias === null || dias >= DIAS_ALERTA_RECENCIA;

/** Colunas do "Exportar base de alunos (CSV)" (§10.7). */
const COLUNAS_CSV: ColunaCsv<LinhaExportAluno>[] = [
  { cabecalho: 'Aluno', valor: (a) => a.nome },
  { cabecalho: 'E-mail cadastrado', valor: (a) => a.email },
  { cabecalho: 'Semestre', valor: (a) => a.semestre },
  { cabecalho: 'Questões resolvidas', valor: (a) => a.questoes },
  { cabecalho: '% de acerto', valor: (a) => (a.acertoPct === null ? '' : formatPct(a.acertoPct)) },
  { cabecalho: 'Vídeos assistidos', valor: (a) => a.videos },
  { cabecalho: 'Documentos lidos', valor: (a) => a.documentos },
  { cabecalho: 'Última atividade', valor: (a) => (a.ultimaAtividade ? formatData(a.ultimaAtividade) : '') },
  { cabecalho: 'Dias sem consumo', valor: (a) => a.diasSemAtividade },
];

/**
 * Tabela "Por aluno" da seção "Consumo dos alunos" (spec §8.2, §12.2). A aba de
 * consumo só realça as colunas dela (cabeçalho e células); a ordem vem do clique no
 * cabeçalho (padrão: questões, da maior para a menor). Busca (300 ms), filtro "Sem
 * atividade há 14 dias" e paginação de 20. O nome do aluno é um botão que filtra a página; a seta
 * abre o drawer. A lista NÃO é filtrada por aluno: o filtrado só aparece realçado.
 */
export function TabelaPorAluno({ filtros, aba, sem14, onSem14Change, iesNome, onAbrirDetalhes }: TabelaPorAlunoProps) {
  const contexto = useGestorContexto();
  const podeExportar = contexto.data?.podeExportar === true;

  const [busca, setBusca] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [ordenacao, setOrdenacao] = React.useState(ORDENACAO_INICIAL);
  const [exportando, setExportando] = React.useState(false);
  const buscaAtrasada = useValorComAtraso(busca);

  // Mudar a busca, o filtro ou a ordenação volta a página para 1 (trocar de aba não mexe na lista).
  React.useEffect(() => {
    setPage(1);
  }, [buscaAtrasada, sem14, ordenacao]);

  const consulta = useEngajamentoAlunos(filtros, ordenacao.coluna, ordenacao.direcao, buscaAtrasada, sem14, page);
  const lista = consulta.data;
  const total = lista?.total ?? 0;
  const inicio = total === 0 ? 0 : (page - 1) * PAGE_SIZE_ALUNOS + 1;
  const fim = Math.min(page * PAGE_SIZE_ALUNOS, total);
  const realcadas = COLUNAS_DA_ABA[aba];
  const realce = (col: 'questoes' | 'acerto' | 'videos' | 'documentos'): React.CSSProperties | undefined =>
    realcadas.includes(col) ? { background: 'var(--gp-brand-surface-soft)' } : undefined;

  const ordemDe = (coluna: OrdemAlunos) => (ordenacao.coluna === coluna ? ordenacao.direcao : null);
  const alternarOrdenacao = (coluna: OrdemAlunos) =>
    setOrdenacao((atual) =>
      atual.coluna === coluna
        ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { coluna, direcao: DIRECAO_PADRAO[coluna] },
    );

  const exportar = async () => {
    setExportando(true);
    try {
      const alunos = await buscarExportAlunos(filtros, ordenacao.coluna, ordenacao.direcao, buscaAtrasada, sem14);
      baixarCsv(nomeArquivoCsv(['engajamento', 'base-alunos', slugIes(iesNome)]), COLUNAS_CSV, alunos);
    } finally {
      setExportando(false);
    }
  };

  const alternarAluno = (id: string) => filtros.setAluno(filtros.alunoId === id ? null : id);

  return (
    <div className="flex flex-col" style={{ gap: 12 }} data-testid="tabela-por-aluno">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 style={{ fontSize: 'var(--gp-font-size-h2)', fontWeight: 'var(--gp-font-weight-forte)' }}>Por aluno</h3>
        <label className="relative w-full min-w-[200px] sm:w-80">
          <span className="sr-only">Buscar aluno nesta lista</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--gp-text-3)' }}
          >
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar aluno pelo nome"
            className="w-full bg-transparent"
            style={{
              height: 34,
              padding: '0 10px 0 32px',
              border: '1px solid var(--gp-border-input)',
              borderRadius: 'var(--gp-radius-sm)',
              fontSize: 'var(--gp-font-size-body)',
              color: 'var(--gp-text-1)',
            }}
          />
        </label>
        <div role="group" aria-label="Filtrar alunos" className="inline-flex sm:ml-auto" style={{ gap: 6 }}>
          {[
            { rotulo: 'Todos', valor: false },
            { rotulo: 'Sem atividade há 14 dias', valor: true },
          ].map((o) => (
            <button
              key={o.rotulo}
              type="button"
              aria-pressed={sem14 === o.valor}
              onClick={() => onSem14Change(o.valor)}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 'var(--gp-radius-pill)',
                fontSize: 'var(--gp-font-size-apoio)',
                fontWeight: 'var(--gp-font-weight-medio)',
                border: `1px solid ${sem14 === o.valor ? 'var(--gp-brand-border)' : 'var(--gp-border-strong)'}`,
                background: sem14 === o.valor ? 'var(--gp-brand-surface)' : 'transparent',
                color: 'var(--gp-text-1)',
              }}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
        {podeExportar ? (
          <Button type="button" variant="outline" size="sm" onClick={exportar} disabled={exportando}>
            <Icon name="download" size={16} /> Exportar base de alunos (CSV)
          </Button>
        ) : null}
      </div>

      {consulta.isError && !lista ? (
        <EstadoErro altura={160} onRetry={consulta.refetch} />
      ) : (
        <div aria-busy={consulta.isPlaceholderData ? true : undefined} className={consulta.isPlaceholderData ? 'opacity-60' : undefined}>
          <TabelaGestor rotulo="Consumo por aluno">
            <CabecalhoTabela>
              <tr>
                <CelulaCabecalho ordem={ordemDe('nome')} onOrdenar={() => alternarOrdenacao('nome')}>
                  Aluno
                </CelulaCabecalho>
                <CelulaCabecalho ordem={ordemDe('semestre')} onOrdenar={() => alternarOrdenacao('semestre')}>
                  Semestre
                </CelulaCabecalho>
                <CelulaCabecalho numerica style={realce('questoes')} ordem={ordemDe('questoes')} onOrdenar={() => alternarOrdenacao('questoes')}>
                  Questões resolvidas
                </CelulaCabecalho>
                <CelulaCabecalho numerica style={realce('acerto')} ordem={ordemDe('acerto')} onOrdenar={() => alternarOrdenacao('acerto')}>
                  % de acerto
                </CelulaCabecalho>
                <CelulaCabecalho numerica style={realce('videos')} ordem={ordemDe('videos')} onOrdenar={() => alternarOrdenacao('videos')}>
                  Vídeos assistidos
                </CelulaCabecalho>
                <CelulaCabecalho numerica style={realce('documentos')} ordem={ordemDe('documentos')} onOrdenar={() => alternarOrdenacao('documentos')}>
                  Documentos lidos
                </CelulaCabecalho>
                <CelulaCabecalho ordem={ordemDe('ultima_atividade')} onOrdenar={() => alternarOrdenacao('ultima_atividade')}>
                  Última atividade
                </CelulaCabecalho>
                <th scope="col" className="sr-only">
                  Detalhes
                </th>
              </tr>
            </CabecalhoTabela>
            <CorpoTabela>
              {consulta.isLoading || !lista ? (
                <LinhasSkeleton colunas={8} linhas={5} />
              ) : lista.data.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--gp-text-3)', fontSize: 'var(--gp-font-size-body)' }}>
                    Nenhum aluno encontrado neste recorte.
                  </td>
                </tr>
              ) : (
                lista.data.map((a: LinhaAlunoEngajamento, i) => {
                  const selecionado = filtros.alunoId === a.id;
                  const critico = nivelDesempenho(a.acertoPct) === 'critico';
                  const alerta = alertaRecencia(a.diasSemAtividade);
                  return (
                    <LinhaTabela
                      key={a.id}
                      selecionada={selecionado}
                      ultima={i === lista.data.length - 1}
                      style={selecionado ? { background: 'var(--gp-brand-surface)' } : undefined}
                    >
                      <Celula marcada={selecionado}>
                        <button
                          type="button"
                          aria-pressed={selecionado}
                          onClick={() => alternarAluno(a.id)}
                          className={selecionado ? 'text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]' : undefined}
                          style={{ fontWeight: 'var(--gp-font-weight-medio)', textAlign: 'left' }}
                        >
                          {a.nome}
                        </button>
                      </Celula>
                      <Celula>{a.semestre}º</Celula>
                      <Celula numerica style={realce('questoes')}>
                        {formatNumero(a.questoes)}
                      </Celula>
                      <Celula
                        numerica
                        ausente={a.acertoPct === null}
                        style={critico ? { ...realce('acerto'), color: 'var(--gp-danger-on)' } : realce('acerto')}
                      >
                        {a.acertoPct === null ? TRACO : formatPct(a.acertoPct)}
                      </Celula>
                      <Celula numerica style={realce('videos')}>
                        {formatNumero(a.videos)}
                      </Celula>
                      <Celula numerica style={realce('documentos')}>
                        {formatNumero(a.documentos)}
                      </Celula>
                      <Celula style={alerta ? { color: 'var(--gp-danger-on)' } : undefined}>{rotuloRecencia(a.diasSemAtividade)}</Celula>
                      <Celula>
                        <button
                          type="button"
                          aria-label={`Abrir detalhes de ${a.nome}`}
                          onClick={() => onAbrirDetalhes(a.id)}
                          className="inline-flex"
                          style={{ color: 'var(--gp-text-3)' }}
                        >
                          <Icon name="chevron_right" size={18} />
                        </button>
                      </Celula>
                    </LinhaTabela>
                  );
                })
              )}
            </CorpoTabela>
          </TabelaGestor>
        </div>
      )}

      {lista && total > 0 ? (
        <RodapeTabela>
          <span>
            Mostrando {formatNumero(inicio)}–{formatNumero(fim)} de {formatNumero(total)} alunos
          </span>
          <Paginacao className="ml-auto" page={page} totalPages={lista.totalPages} onPageChange={setPage} rotulo="Paginação de alunos" />
        </RodapeTabela>
      ) : null}
    </div>
  );
}
