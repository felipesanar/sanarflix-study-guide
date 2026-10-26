import * as React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/features/gestor/components/Icon';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { useEngajamentoAluno } from '@/features/gestor/api/engajamento';
import type {
  AlunoEngajamento,
  ItemTimeline,
  SituacaoAlunoEngajamento,
} from '@/features/gestor/api/types-engajamento';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import { diaMes, iniciais, mesCurto, rotuloRecencia } from '@/features/gestor/lib/engajamento';
import { formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import { BarraHorizontal } from './BarraHorizontal';
import { FiguraGrafico } from './FiguraGrafico';

export interface DrawerAlunoEngajamentoProps {
  alunoId: string;
  filtros: FiltrosEngajamento;
  onFechar: () => void;
}

const ROTULO_SITUACAO: Record<SituacaoAlunoEngajamento, string> = {
  ativo: 'Ativo',
  sumido: 'Sumido',
  sem_atividade: 'Sem atividade',
};

/** Cores das três séries do "Atividade mês a mês" (§13). */
const COR_QUESTOES = 'var(--gp-brand-strong)';
const COR_VIDEOS = 'color-mix(in srgb, var(--gp-brand) 70%, var(--gp-surface-1))';
const COR_DOCUMENTOS = 'color-mix(in srgb, var(--gp-brand) 30%, var(--gp-surface-1))';

const ALTURA_BARRAS = 120;

/** Texto de um item de "Últimas atividades" (§12.2). */
export function textoItemTimeline(item: ItemTimeline): string {
  if (item.tipo === 'questoes') {
    const acerto = item.acertoPct === null ? '' : ` (${formatPct(item.acertoPct)} de acerto)`;
    return `Resolveu ${formatNumero(item.questoes ?? 0)} questões de ${item.especialidade}${acerto}`;
  }
  if (item.tipo === 'video') return `Assistiu “${item.conteudo ?? ''}” · ${item.especialidade}`;
  return `Abriu o documento “${item.conteudo ?? ''}” · ${item.especialidade}`;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col" style={{ gap: 8 }}>
      <h3 style={{ fontSize: 'var(--gp-font-size-h3)', fontWeight: 'var(--gp-font-weight-forte)', color: 'var(--gp-text-1)' }}>{titulo}</h3>
      {children}
    </section>
  );
}

function Cartao({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div
      data-testid="drawer-cartao"
      style={{ padding: 12, borderRadius: 'var(--gp-radius-md)', background: 'var(--gp-surface-2)', border: '1px solid var(--gp-border-subtle)' }}
    >
      <div style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>{titulo}</div>
      <div
        data-testid="drawer-cartao-valor"
        className="tabular-nums"
        style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--gp-text-1)', lineHeight: '28px' }}
      >
        {valor}
      </div>
      {nota ? <div style={{ fontSize: 'var(--gp-font-size-micro)', color: 'var(--gp-text-3)' }}>{nota}</div> : null}
    </div>
  );
}

function AtividadeMesAMes({ meses }: { meses: AlunoEngajamento['meses'] }) {
  const total = (m: AlunoEngajamento['meses'][number]) => m.questoes / 4 + m.videos + m.documentos;
  const maximo = meses.reduce((mx, m) => Math.max(mx, total(m)), 0);
  const altura = (v: number) => (maximo > 0 ? (v / maximo) * ALTURA_BARRAS : 0);

  return (
    <Secao titulo="Atividade mês a mês">
      <FiguraGrafico
        rotulo="Atividade mês a mês"
        cabecalho={['Mês', 'Atividade']}
        linhasTabela={meses.map((m) => ({
          rotulo: mesCurto(m.mes, m.parcial),
          valor: `${formatNumero(m.questoes)} questões · ${formatNumero(m.videos)} vídeos · ${formatNumero(m.documentos)} documentos`,
        }))}
      >
        <div className="flex items-end" style={{ gap: 6 }}>
          {meses.map((m) => (
            <div key={m.mes} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full flex-col-reverse items-center" style={{ height: ALTURA_BARRAS, justifyContent: 'flex-start' }}>
                {[
                  { chave: 'questoes', valor: m.questoes / 4, cor: COR_QUESTOES },
                  { chave: 'videos', valor: m.videos, cor: COR_VIDEOS },
                  { chave: 'documentos', valor: m.documentos, cor: COR_DOCUMENTOS },
                ].map((s) => (
                  <div
                    key={s.chave}
                    data-testid={`drawer-barra-${s.chave}`}
                    style={{ width: '70%', maxWidth: 28, height: altura(s.valor), background: s.cor }}
                  />
                ))}
              </div>
              <span style={{ marginTop: 4, fontSize: 'var(--gp-font-size-label)', color: 'var(--gp-text-2)' }}>{mesCurto(m.mes, m.parcial)}</span>
            </div>
          ))}
        </div>
        <ul
          className="m-0 flex list-none flex-wrap p-0"
          style={{ gap: 12, marginTop: 8, fontSize: 'var(--gp-font-size-micro)', color: 'var(--gp-text-3)' }}
        >
          {[
            { rotulo: 'Questões (÷4)', cor: COR_QUESTOES },
            { rotulo: 'Vídeos', cor: COR_VIDEOS },
            { rotulo: 'Documentos', cor: COR_DOCUMENTOS },
          ].map((l) => (
            <li key={l.rotulo} className="inline-flex items-center" style={{ gap: 4 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: l.cor }} />
              {l.rotulo}
            </li>
          ))}
        </ul>
      </FiguraGrafico>
    </Secao>
  );
}

/**
 * Drawer do aluno (spec §8.4, §12.2), aberto pela seta da tabela "Por aluno".
 * Mostra o resumo do período, a atividade mês a mês, o acerto por especialidade
 * contra a média do semestre e as últimas atividades. "Filtrar a página por este
 * aluno" grava `aluno` na URL (e apaga o semestre) e fecha o drawer.
 */
export function DrawerAlunoEngajamento({ alunoId, filtros, onFechar }: DrawerAlunoEngajamentoProps) {
  useDevolverFocoAoFechar(true);
  const container = useGestorPortalContainer();
  const consulta = useEngajamentoAluno(filtros, alunoId);
  const dados = consulta.data;
  const aluno = dados?.aluno;

  const filtrarPorEsteAluno = () => {
    filtros.setAluno(alunoId);
    onFechar();
  };

  return (
    <Sheet open onOpenChange={(aberto) => (aberto ? undefined : onFechar())}>
      <SheetContent
        container={container}
        side="right"
        aria-label="Detalhes do aluno"
        aria-labelledby={undefined}
        className="flex w-full flex-col gap-4 overflow-y-auto p-[22px] sm:max-w-[420px]"
        style={{ boxShadow: 'var(--gp-shadow-panel)' }}
        closeIcon={<Icon name="close" size={16} />}
        closeLabel="Fechar detalhes"
        closeClassName="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] text-[color:var(--gp-text-3)] opacity-100"
        overlayClassName="bg-[var(--gp-scrim)]"
      >
        <SheetHeader className="space-y-0">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex items-center justify-center"
              style={{
                width: 42,
                height: 42,
                flex: 'none',
                borderRadius: '50%',
                background: 'var(--gp-brand-surface)',
                color: 'var(--gp-brand-strong)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {aluno ? iniciais(aluno.nome) : ''}
            </span>
            <div className="min-w-0 flex-1 text-left">
              <SheetTitle style={{ fontSize: 15, fontWeight: 700 }}>{aluno ? aluno.nome : 'Detalhes do aluno'}</SheetTitle>
              <SheetDescription style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                {aluno
                  ? `${aluno.semestre}º semestre · ${ROTULO_SITUACAO[aluno.situacao]} · última atividade ${rotuloRecencia(aluno.diasSemAtividade)}`
                  : consulta.isError
                    ? 'Não foi possível carregar os dados do aluno'
                    : 'Carregando dados do aluno'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {consulta.isError && !dados ? (
          <EstadoErro altura={200} onRetry={consulta.refetch} />
        ) : !dados ? (
          <GestorSkeleton altura={420} forma="cartao" rotulo="Carregando detalhes do aluno" />
        ) : (
          <>
            <div className="grid grid-cols-2" style={{ gap: 10 }}>
              <Cartao titulo="Questões" valor={formatNumero(dados.resumo.questoes)} nota={`média do semestre: ${formatNumero(dados.resumo.mediaSemestreQuestoes)}`} />
              <Cartao titulo="Acerto" valor={formatPct(dados.resumo.acertoPct)} nota={`média do semestre: ${formatPct(dados.resumo.mediaSemestreAcertoPct)}`} />
              <Cartao titulo="Vídeos · Docs" valor={`${formatNumero(dados.resumo.videos)} · ${formatNumero(dados.resumo.documentos)}`} />
              <Cartao titulo="Dias ativos" valor={formatNumero(dados.resumo.diasAtivos)} nota={`de ${formatNumero(dados.resumo.diasNoPeriodo)} no período`} />
            </div>

            <AtividadeMesAMes meses={dados.meses} />

            <Secao titulo="Acerto por especialidade vs. semestre">
              {dados.especialidades.length === 0 ? (
                <p style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>Nenhuma questão classificada neste recorte.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0" style={{ gap: 10 }}>
                  {dados.especialidades.map((e) => (
                    <li key={e.id} data-testid="drawer-especialidade">
                      <div className="flex items-baseline justify-between" style={{ gap: 8, fontSize: 'var(--gp-font-size-apoio)' }}>
                        <span style={{ color: 'var(--gp-text-1)' }}>{e.nome}</span>
                        <span className="tabular-nums" style={{ color: 'var(--gp-text-2)' }}>
                          {e.acertoPct === null ? TRACO : formatPct(e.acertoPct)} ({formatNumero(e.questoes)})
                        </span>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <BarraHorizontal pct={e.acertoPct ?? 0} marcador={e.acertoPctSemestre} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ fontSize: 'var(--gp-font-size-micro)', color: 'var(--gp-text-3)' }}>Traço preto = média do mesmo semestre</p>
            </Secao>

            <Secao titulo="Últimas atividades">
              {dados.timeline.length === 0 ? (
                <p style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>Nenhuma atividade registrada</p>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0" style={{ gap: 8 }}>
                  {dados.timeline.map((item, i) => (
                    <li key={`${item.dia}-${i}`} className="flex" style={{ gap: 10, fontSize: 'var(--gp-font-size-apoio)' }}>
                      <span className="tabular-nums" style={{ flex: 'none', width: 40, color: 'var(--gp-text-3)' }}>
                        {diaMes(item.dia)}
                      </span>
                      <span style={{ color: 'var(--gp-text-1)' }}>{textoItemTimeline(item)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>

            <Button type="button" onClick={filtrarPorEsteAluno} className="mt-auto">
              Filtrar a página por este aluno
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
