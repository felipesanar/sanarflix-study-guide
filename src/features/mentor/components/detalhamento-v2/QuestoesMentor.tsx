import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { Icon } from '@/features/gestor/components/Icon';
import { ORDENACOES_QUESTOES, formatNumeroQuestao, type OrdenacaoQuestoes } from '@/features/gestor/components/TabelaQuestoes';
import {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  FONTE_MONO,
  LinhaTabela,
  LinhasSkeleton,
  Paginacao,
  RodapeTabela,
  TabelaGestor,
} from '@/features/gestor/components/tabela';
import { formatPct } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import type { QuestaoResumoMentor } from '@/features/mentor/api/types';
import type { OrdemQuestoes } from './derivar';
import { estiloBloco, h2Bloco } from './estilos';

const TODAS = '__todas__';
const PARA_GESTOR: Record<OrdemQuestoes, OrdenacaoQuestoes> = { prova: 'ordem_da_prova', erradas: 'mais_erradas', acertadas: 'mais_acertadas' };
const DO_GESTOR: Record<OrdenacaoQuestoes, OrdemQuestoes> = { ordem_da_prova: 'prova', mais_erradas: 'erradas', mais_acertadas: 'acertadas' };
const COR_NIVEL = { critico: 'var(--gp-danger)', mediano: 'var(--gp-warning)', excelente: 'var(--gp-success)' } as const;
const POR_PAGINA = 20;

export interface QuestoesMentorProps {
  estado: 'loading' | 'error' | 'ok';
  questoes: QuestaoResumoMentor[];
  /** Grandes áreas do simulado (opções do filtro). */
  areas: string[];
  area: string | null;
  onArea: (a: string | null) => void;
  ordem: OrdemQuestoes;
  onOrdem: (o: OrdemQuestoes) => void;
  /** Nome do simulado das questões (o mais recente do recorte). */
  simuladoNome: string | null;
  /** Botão do cabeçalho (B2B: "Levar para a oficina"). */
  acaoCabecalho?: React.ReactNode;
  renderDetalhe: (q: QuestaoResumoMentor) => React.ReactNode;
  onTentarNovamente: () => void;
}

/**
 * Detalhamento das questões (docs/02 § Tela 3 · 7) com a anatomia da `TabelaQuestoes` do Gestor
 * (mesmas primitivas de tabela, ordenações e Nº em `Q00`), linha inteira expansível.
 */
export function QuestoesMentor(p: QuestoesMentorProps) {
  const container = useGestorPortalContainer();
  const [aberta, setAberta] = React.useState<string | null>(null);
  const [pagina, setPagina] = React.useState(1);
  React.useEffect(() => { setPagina(1); setAberta(null); }, [p.area, p.ordem, p.simuladoNome]);

  const total = p.questoes.length;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const atual = Math.min(pagina, totalPaginas);
  const daPagina = p.questoes.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);
  const alternar = (id: string) => setAberta((a) => (a === id ? null : id));

  return (
    <section aria-labelledby="dq-h" data-testid="bloco-questoes" className="flex min-w-0 flex-col gap-3.5" style={estiloBloco}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center" style={{ borderRadius: 7, border: '1px solid var(--gp-border-strong)' }}>
          <Icon name="format-list-bullet" size={15} />
        </span>
        <h2 id="dq-h" className="flex-1" style={h2Bloco}>Detalhamento das questões</h2>
        {p.estado === 'ok' ? (
          <span data-testid="questoes-total" style={{ fontSize: 12, color: 'var(--gp-text-3)', fontVariantNumeric: 'tabular-nums' }}>
            {total} {total === 1 ? 'questão' : 'questões'}{p.simuladoNome ? ` · ${p.simuladoNome}` : ''}
          </span>
        ) : null}
        {p.acaoCabecalho}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Select value={p.area ?? TODAS} onValueChange={(v) => p.onArea(v === TODAS ? null : v)} disabled={p.estado !== 'ok'}>
          <SelectTrigger
            aria-label="Filtrar por grande área"
            className="h-9 w-auto gap-1.5 px-2.5 text-[13px]"
            style={{ borderRadius: 8, borderColor: 'var(--gp-border-input)' }}
            icon={<Icon name="expand_more" size={15} className="opacity-70" />}
          >
            <span className="flex items-center gap-1 whitespace-nowrap">
              Grande área:
              <span style={{ fontWeight: 650 }}><SelectValue /></span>
            </span>
          </SelectTrigger>
          <SelectContent container={container}>
            <SelectItem value={TODAS}>Todas</SelectItem>
            {p.areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>

        <ToggleGroup
          type="single"
          value={PARA_GESTOR[p.ordem]}
          onValueChange={(v) => v && p.onOrdem(DO_GESTOR[v as OrdenacaoQuestoes])}
          aria-label="Ordenação das questões"
          className="ml-auto flex-wrap gap-0.5 p-[3px]"
          style={{ background: 'var(--gp-surface-3)', borderRadius: 9 }}
        >
          {ORDENACOES_QUESTOES.map((o) => (
            <ToggleGroupItem
              key={o.valor}
              value={o.valor}
              className="h-8 gap-1.5 whitespace-nowrap px-3.5 text-[13px] font-semibold data-[state=on]:bg-[#111212] data-[state=on]:text-white"
              style={{ borderRadius: 7 }}
            >
              {o.icone ? <Icon name={o.icone} size={14} /> : null}
              {o.rotulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {p.estado === 'error' ? (
        <EstadoErro titulo="Não foi possível carregar as questões." onRetry={p.onTentarNovamente} />
      ) : p.estado === 'ok' && total === 0 ? (
        <EstadoVazio
          titulo={p.area ? 'Nenhuma questão desta grande área no recorte.' : 'Sem questões respondidas neste recorte.'}
          acao={p.area ? { rotulo: 'Limpar filtro', onClick: () => p.onArea(null) } : undefined}
          compacto
        />
      ) : (
        <>
          <div className="overflow-x-auto" style={{ border: '1px solid var(--gp-border-strong)', borderRadius: 10 }}>
            <TabelaGestor rotulo="Detalhamento das questões">
              <CabecalhoTabela>
                <tr>
                  <CelulaCabecalho largura={64}>Nº</CelulaCabecalho>
                  <CelulaCabecalho>Grande área</CelulaCabecalho>
                  <CelulaCabecalho>Especialidade</CelulaCabecalho>
                  <CelulaCabecalho>Tema</CelulaCabecalho>
                  <CelulaCabecalho largura={150}>Índice de acerto</CelulaCabecalho>
                </tr>
              </CabecalhoTabela>
              <CorpoTabela>
                {p.estado === 'loading' ? <LinhasSkeleton colunas={5} /> : daPagina.map((q, i) => {
                  const estaAberta = aberta === q.questaoId;
                  const nivel = nivelDesempenho(q.acertoPct);
                  const critico = nivel === 'critico';
                  const ultima = i === daPagina.length - 1;
                  const numero = q.numero === null ? '—' : formatNumeroQuestao(q.numero);
                  return (
                    <React.Fragment key={q.questaoId}>
                      <LinhaTabela
                        data-testid={`linha-questao-${q.questaoId}`}
                        selecionada={estaAberta}
                        ultima={ultima && !estaAberta}
                        onSelecionar={(e: React.MouseEvent<HTMLTableRowElement>) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          alternar(q.questaoId);
                        }}
                      >
                        <Celula>
                          <button
                            type="button"
                            aria-expanded={estaAberta}
                            aria-controls={`detalhe-${q.questaoId}`}
                            aria-label={`Ver detalhe da questão ${q.numero ?? ''}`.trim()}
                            onClick={() => alternar(q.questaoId)}
                            className="inline-flex items-center gap-1 font-semibold tabular-nums"
                            style={{ fontFamily: FONTE_MONO }}
                          >
                            <Icon name="expand_more" size={14} className={cn('transition-transform duration-200', estaAberta && 'rotate-180')} />
                            {numero}
                          </button>
                        </Celula>
                        <Celula><span className="block max-w-[200px] truncate" title={q.grandeArea}>{q.grandeArea}</span></Celula>
                        <Celula><span className="block max-w-[200px] truncate" title={q.especialidade ?? undefined}>{q.especialidade ?? '—'}</span></Celula>
                        <Celula><span className="block max-w-[240px]" title={q.tema}>{q.temaCurto ?? q.tema}</span></Celula>
                        <Celula>
                          <span className="flex items-center gap-2">
                            <span aria-hidden="true" className="block h-1.5 flex-1 overflow-hidden" style={{ borderRadius: 999, background: 'var(--gp-border-subtle)', minWidth: 48 }}>
                              {nivel && q.acertoPct !== null ? (
                                <span className="block h-full w-full origin-left" style={{ background: COR_NIVEL[nivel], transform: `scaleX(${Math.max(0, Math.min(100, q.acertoPct)) / 100})` }} />
                              ) : null}
                            </span>
                            <span
                              className={cn('inline-flex w-14 items-center justify-end gap-0.5 font-semibold tabular-nums', critico && 'gp-text-danger')}
                              style={critico ? undefined : { color: 'var(--gp-text-1)' }}
                            >
                              {critico ? <Icon name="report_problem" size={12} aria-label="abaixo de 50%" /> : null}
                              {formatPct(q.acertoPct)}
                            </span>
                          </span>
                        </Celula>
                      </LinhaTabela>
                      {estaAberta ? (
                        <LinhaTabela selecionada ultima={ultima}>
                          <Celula colSpan={5} id={`detalhe-${q.questaoId}`} data-testid={`detalhe-${q.questaoId}`}>
                            {p.renderDetalhe(q)}
                          </Celula>
                        </LinhaTabela>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </CorpoTabela>
            </TabelaGestor>
          </div>
          {p.estado === 'ok' && totalPaginas > 1 ? (
            <RodapeTabela>
              <p>Mostrando {daPagina.length} de {total} questões</p>
              <Paginacao className="ml-auto" rotulo="Paginação das questões" page={atual} totalPages={totalPaginas} onPageChange={setPagina} />
            </RodapeTabela>
          ) : null}
        </>
      )}
    </section>
  );
}
