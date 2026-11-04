import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { SeletorSimulados } from '@/features/gestor/components/SeletorSimulados';
import { formatNumeroQuestao } from '@/features/gestor/components/TabelaQuestoes';
import { formatData } from '@/features/gestor/lib/formatters';
import { mensagemErro } from '@/features/mentor/api/erros';
import { metaMentor } from '@/features/mentor/api/meta';
import {
  useAlunosB2b,
  useCronogramaB2b,
  useDesempenhoTurma,
  useDetalhamento,
  useDetalhamentoB2b,
  useQuestoesB2b,
  useRegistrarEvento,
  useSerieTurma,
  useSimuladosMentor,
  useTemasTurma,
  useTemasTurmaB2b,
  useTurmaAcademy,
} from '@/features/mentor/api/queries';
import type { AcertoArea, AcertoTema, QuestaoResumoMentor, SimuladoMentor } from '@/features/mentor/api/types';
import { KpisDetalhamentoMentor } from '@/features/mentor/components/KpisDetalhamentoMentor';
import { AcertoPorPrevalencia } from './AcertoPorPrevalencia';
import { DetalheQuestaoB2b, DetalheQuestaoB2c, type AcoesQuestao } from './DetalheQuestao';
import { DiagnosticoIa } from './DiagnosticoIa';
import { DrawerGrandeArea } from './DrawerGrandeArea';
import { LevarOficina } from './LevarOficina';
import { QuestoesMentor } from './QuestoesMentor';
import { Toast, useToast } from './Toast';
import { VisaoAlunos } from './VisaoAlunos';
import { urlMuralPreenchido } from './deepLinks';
import {
  alunosVisaoB2b,
  alunosVisaoB2c,
  curto,
  disponivel,
  itensSeletor,
  kpisB2c,
  matrizPrevalencia,
  porSimuladoB2b,
  questoesDoRecorte,
  rotuloRecorte,
  simuladosDoRecorte,
  temasComPrevalencia,
} from './derivar';
import { estiloBloco } from './estilos';
import { useEstadoUrl } from './useEstadoUrl';
import type { DiagnosticoIa as Diagnostico } from './useDiagnosticoIa';

type Modalidade = 'b2c' | 'b2b';
type Estado = 'loading' | 'error' | 'ok';
const estadoDe = (r: { isLoading: boolean; isError: boolean }): Estado => (r.isError ? 'error' : r.isLoading ? 'loading' : 'ok');

const NOTA: Record<Modalidade, string> = {
  b2c: 'Não existe "todos": o agregado da turma é a Minha Turma. Previstos ou em processamento ficam desabilitados.',
  b2b: 'Não existe "todos": o agregado do período é a Visão Geral. Previstos ou em processamento ficam desabilitados.',
};
const COMO_LER: Record<Modalidade, [string, string][]> = {
  b2c: [
    ['Percentual de acerto', 'Questões certas sobre respondidas; anulada fica fora.'],
    ['Possível aprovação', 'Acima do corte da meta mais difícil de cada aluno. Comparativo só com 2+ simulados.'],
    ['Prevalência', 'Peso do tema na prova: Alta 62%, Média 28%, Baixa 10%.'],
  ],
  b2b: [
    ['Percentual de acerto', 'Questões certas sobre respondidas; anulada fica fora.'],
    ['Conceito e TRI projetados', 'Estimativas por simulado, não resultado oficial do INEP. Proficiente = 60 ou mais.'],
    ['Prevalência', 'Peso do tema na prova: Alta 62%, Média 28%, Baixa 10%.'],
  ],
};

/** "Cronograma: 6º Simulado PRO em 09/11" (texto do protótipo). */
export function textoCronograma(simulados: SimuladoMentor[]): string {
  const proximo = [...simulados].filter((s) => !disponivel(s)).sort((a, b) => a.ordem - b.ordem)[0];
  if (!proximo) return 'Cronograma: nenhum simulado agendado';
  const data = proximo.data ? formatData(proximo.data).slice(0, 5) : null;
  return data && data !== '—' ? `Cronograma: ${proximo.nome} em ${data}` : `Cronograma: ${proximo.nome}, sem data`;
}

function ComoLer({ modalidade }: { modalidade: Modalidade }) {
  const [aberto, setAberto] = React.useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button type="button" aria-expanded={aberto} aria-controls="como-ler" onClick={() => setAberto((a) => !a)}
        className="inline-flex items-center gap-1 self-start whitespace-nowrap" style={{ color: 'var(--gp-text-2)', fontSize: 12.5 }}>
        <Icon name={aberto ? 'expand_more' : 'chevron_right'} size={14} />
        Como ler estes indicadores
      </button>
      {aberto ? (
        <dl id="como-ler" className="grid gap-x-6 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', margin: 0, padding: '12px 16px', borderRadius: 10, background: 'var(--gp-surface-1)', border: '1px solid var(--gp-border-strong)', fontSize: 12.5 }}>
          {COMO_LER[modalidade].map(([t, d]) => (
            <div key={t}>
              <dt style={{ fontWeight: 650 }}>{t}</dt>
              <dd style={{ margin: '2px 0 0', color: 'var(--gp-text-2)' }}>{d}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

interface MolduraProps {
  modalidade: Modalidade;
  simulados: { data: SimuladoMentor[] | undefined; isLoading: boolean; isError: boolean; error: unknown; refetch: () => void };
  url: ReturnType<typeof useEstadoUrl>;
  toast: ReturnType<typeof useToast>;
  children: (sel: SimuladoMentor[]) => React.ReactNode;
}

/** Cabeçalho, seletor e "Como ler" (docs/02 § Tela 3 · 1–3) e os estados da página. */
function Moldura({ modalidade, simulados, url, toast, children }: MolduraProps) {
  const lista = simulados.data ?? [];
  const sel = simuladosDoRecorte(url.selecionados, lista);
  const itens = React.useMemo(() => itensSeletor(lista), [lista]);
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="mentor-detalhamento">
      <header className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="flex min-w-[260px] flex-1 flex-col gap-0.5">
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Detalhamento de simulados</h1>
          <span style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>Escolha um ou mais simulados para ver o desempenho questão por questão.</span>
        </div>
        <button type="button" onClick={() => toast.mostrar(textoCronograma(lista))} disabled={!simulados.data}
          className="inline-flex items-center gap-0.5 whitespace-nowrap py-1" style={{ color: '#941F1F', fontWeight: 600, fontSize: 13 }}>
          Ver cronograma
          <Icon name="chevron_right" size={15} />
        </button>
      </header>

      {simulados.isLoading ? (
        <div className="flex flex-col gap-4" data-testid="detalhamento-carregando">
          <GestorSkeleton altura={96} rotulo="Carregando simulados" />
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => <GestorSkeleton key={i} altura={150} forma="cartao" rotulo="Carregando indicadores" />)}
          </div>
          <GestorSkeleton altura={320} forma="cartao" rotulo="Carregando acerto por prevalência" />
        </div>
      ) : simulados.isError ? (
        <EstadoErro titulo="Não foi possível carregar os simulados." descricao={mensagemErro(simulados.error)} onRetry={simulados.refetch} />
      ) : !lista.some(disponivel) ? (
        <div data-testid="sem-simulado" className="flex flex-col items-center gap-2 text-center"
          style={{ ...estiloBloco, borderStyle: 'dashed', padding: '40px 24px' }}>
          <Icon name="quiz" size={24} />
          <span style={{ fontWeight: 650, fontSize: 15 }}>Nenhum simulado disponível</span>
        </div>
      ) : (
        <>
          <SeletorSimulados
            itens={itens}
            selecionados={url.selecionados}
            onChange={url.setSelecionados}
            nota={NOTA[modalidade]}
            ehProvaOficial={() => false}
          />
          {sel.length > 0 ? (
            <>
              <ComoLer modalidade={modalidade} />
              {children(sel)}
            </>
          ) : null}
        </>
      )}
      <Toast mensagem={toast.mensagem} />
    </div>
  );
}

/** Ações comuns: intervenção por tema/questão (hook de evento) e deep link para o mural. */
function useAcoes(modalidade: Modalidade, toast: ReturnType<typeof useToast>) {
  const navigate = useNavigate();
  const evento = useRegistrarEvento();
  const criar = async (temaId: string, tema: string, acertoPct: number | null, origem: 'tema_critico' | 'questao', sufixo: string) => {
    try {
      const r = await evento.mutateAsync({ tipo: 'intervencao_tema', temaId, tema, acertoPct: acertoPct === null ? null : Math.round(acertoPct), origem });
      toast.mostrar(r.duplicado ? `Essa intervenção já está no kanban${sufixo}` : `Intervenção criada em A fazer${sufixo}`);
    } catch (e) {
      toast.mostrar(mensagemErro(e));
    }
  };
  return {
    pendente: evento.isPending,
    intervencaoTema: (area: string, esp: string, t: AcertoTema) =>
      void criar(`tema:${area}|${esp}|${t.tema}`, t.tema, t.acertoPct, 'tema_critico', `: ${t.tema}`),
    intervencaoQuestao: (q: QuestaoResumoMentor) =>
      void criar(`questao:${q.questaoId}`, `${q.numero === null ? 'Questão' : formatNumeroQuestao(q.numero)} · ${q.temaCurto ?? q.tema}`, q.acertoPct, 'questao', ''),
    mensagemQuestao: (q: QuestaoResumoMentor, _letra: string, emails: string[]) =>
      navigate(urlMuralPreenchido(modalidade, { para: emails, tag: 'desempenho', titulo: `${q.temaCurto ?? q.tema}: o erro que mais apareceu` })),
    levarMural: (d: Diagnostico, ultimo: SimuladoMentor) =>
      navigate(urlMuralPreenchido(modalidade, {
        tag: 'desempenho',
        titulo: `Onde a turma perde ponto no ${curto(ultimo.ordem)} simulado`,
        mensagem: [d.resumo, ...d.itens.map((i, n) => `${n + 1}. ${i.destaque} ${i.texto}`.trim())].filter(Boolean).join('\n'),
      })),
  };
}

function Blocos(p: {
  modalidade: Modalidade;
  sel: SimuladoMentor[];
  kpis: React.ReactNode;
  aviso?: React.ReactNode;
  matriz: { estado: Estado; dados: ReturnType<typeof matrizPrevalencia> | undefined; refetch: () => void };
  areas: AcertoArea[] | undefined;
  areasCarregando: boolean;
  alunos: React.ReactNode;
  questoes: { estado: Estado; lista: QuestaoResumoMentor[]; refetch: () => void };
  url: ReturnType<typeof useEstadoUrl>;
  acoes: ReturnType<typeof useAcoes>;
  toast: ReturnType<typeof useToast>;
  detalhe: (q: QuestaoResumoMentor, acoes: AcoesQuestao) => React.ReactNode;
  acaoQuestoes?: React.ReactNode;
}) {
  const ultimo = p.sel[p.sel.length - 1];
  const recorte = rotuloRecorte(p.sel);
  const doSimulado = React.useMemo(() => questoesDoRecorte(p.questoes.lista, ultimo.ordem, null, 'prova'), [p.questoes.lista, ultimo.ordem]);
  const areasQuestoes = React.useMemo(() => [...new Set(doSimulado.map((q) => q.grandeArea))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [doSimulado]);
  const lista = React.useMemo(() => questoesDoRecorte(p.questoes.lista, ultimo.ordem, p.url.area, p.url.ordem), [p.questoes.lista, ultimo.ordem, p.url.area, p.url.ordem]);
  const acoesQuestao: AcoesQuestao = {
    onIntervencao: p.acoes.intervencaoQuestao,
    onMensagem: p.acoes.mensagemQuestao,
    onAbrirAluno: p.url.abrirAluno,
    intervencaoPendente: p.acoes.pendente,
  };
  const areaAberta = p.url.areaDrawer;
  return (
    <>
      {p.aviso}
      {p.kpis}
      <div className="flex flex-wrap items-start gap-4">
        <AcertoPorPrevalencia
          estado={p.matriz.estado}
          matriz={p.matriz.dados}
          regua={p.modalidade === 'b2c' ? 'b2c' : 'gestor'}
          onDetalhar={(a) => p.url.setAreaDrawer(a)}
          onTentarNovamente={p.matriz.refetch}
        />
        <DiagnosticoIa
          modalidade={p.modalidade}
          simulados={p.sel.map((s) => s.id)}
          recorte={recorte}
          onLevarMural={(d) => p.acoes.levarMural(d, ultimo)}
          onToast={p.toast.mostrar}
        />
      </div>
      {p.alunos}
      <QuestoesMentor
        estado={p.questoes.estado}
        questoes={lista}
        areas={areasQuestoes}
        area={p.url.area}
        onArea={p.url.setArea}
        ordem={p.url.ordem}
        onOrdem={p.url.setOrdem}
        simuladoNome={p.sel.length > 1 ? ultimo.nome : null}
        acaoCabecalho={p.acaoQuestoes}
        renderDetalhe={(q) => p.detalhe(q, acoesQuestao)}
        onTentarNovamente={p.questoes.refetch}
      />
      <DrawerGrandeArea
        nome={areaAberta}
        area={p.areas?.find((a) => a.grandeArea === areaAberta)}
        carregando={p.areasCarregando}
        recorte={recorte}
        onFechar={() => p.url.setAreaDrawer(null)}
        onIntervencao={(t, esp) => areaAberta && p.acoes.intervencaoTema(areaAberta, esp, t)}
      />
    </>
  );
}

// ─── B2C ────────────────────────────────────────────────────────────────────

function DetalhamentoB2c() {
  const simulados = useSimuladosMentor();
  const serie = useSerieTurma(null);
  // Participantes por simulado (meta do seletor) vêm da série da turma, sem chamada extra.
  const lista = React.useMemo(
    () => simulados.data?.map((s) => ({ ...s, participantes: serie.data?.find((p) => p.simuladoId === s.id)?.participantes ?? s.participantes })),
    [simulados.data, serie.data],
  );
  const url = useEstadoUrl(lista);
  const toast = useToast();
  const acoes = useAcoes('b2c', toast);
  const ids = url.selecionados;
  const recorteIds = ids.length ? ids : null;
  const desempenho = useDesempenhoTurma(recorteIds);
  const temas = useTemasTurma(recorteIds);
  const det = useDetalhamento(ids);
  const turma = useTurmaAcademy();

  const nomes = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const a of desempenho.data?.alunos ?? []) if (a.nome) m.set(a.email, a.nome);
    for (const a of turma.data ?? []) if (a.nome) m.set(a.email, a.nome);
    return m;
  }, [desempenho.data, turma.data]);

  return (
    <Moldura modalidade="b2c" simulados={{ ...simulados, data: lista }} url={url} toast={toast}>
      {(sel) => {
        const ultimo = sel[sel.length - 1];
        const k = kpisB2c(sel, serie.data ?? [], desempenho.data);
        const bloqueados = (det.data?.bloqueados ?? []).filter((b) => ids.includes(b.simuladoId));
        const ordemAreas = det.data?.areas.map((a) => a.grandeArea) ?? [];
        return (
          <Blocos
            modalidade="b2c"
            sel={sel}
            url={url}
            acoes={acoes}
            toast={toast}
            aviso={bloqueados.length > 0 ? (
              <p role="note" data-testid="nota-bloqueados" style={{ fontSize: 12, color: 'var(--gp-text-2)' }}>
                {bloqueados.map((b) => `${b.ordem ? curto(b.ordem) : ''} simulado: resultado ainda não liberado aos alunos${b.liberaEm ? ` (libera em ${formatData(b.liberaEm).slice(0, 5)})` : ''}`).join(' · ')}. Não entra nos números abaixo.
              </p>
            ) : null}
            kpis={(
              <KpisDetalhamentoMentor
                modalidade="b2c"
                meta={metaMentor({ periodo: `${rotuloRecorte(sel)} simulados`, criterio: 'Participantes dos simulados do recorte' })}
                estado={serie.isError || desempenho.isError ? 'error' : serie.isLoading || desempenho.isLoading ? 'loading' : 'ok'}
                acertoMedio={k.acertoMedio}
                participantes={k.participantes}
                porSimulado={k.porSimulado}
                totalTurma={k.totalTurma}
                onTentarNovamente={() => { serie.refetch(); desempenho.refetch(); }}
              />
            )}
            matriz={{
              estado: temas.isError || det.isError ? 'error' : temas.isLoading || det.isLoading ? 'loading' : 'ok',
              dados: temas.data && det.data ? matrizPrevalencia(temas.data, ordemAreas) : undefined,
              refetch: () => { temas.refetch(); det.refetch(); },
            }}
            areas={det.data?.areas}
            areasCarregando={det.isLoading}
            alunos={(
              <VisaoAlunos
                modalidade="b2c"
                estado={estadoDe(desempenho)}
                alunos={alunosVisaoB2c(desempenho.data, turma.data, ultimo.id)}
                multiSimulado={sel.length > 1}
                onAbrirAluno={url.abrirAluno}
                onTentarNovamente={desempenho.refetch}
              />
            )}
            questoes={{ estado: estadoDe(det), lista: det.data?.questoes ?? [], refetch: det.refetch }}
            detalhe={(q, a) => <DetalheQuestaoB2c q={q} simuladoId={ultimo.id} nomeDe={(e) => nomes.get(e) ?? e} acoes={a} />}
          />
        );
      }}
    </Moldura>
  );
}

// ─── B2B ────────────────────────────────────────────────────────────────────

function DetalhamentoB2b() {
  const simulados = useCronogramaB2b();
  const url = useEstadoUrl(simulados.data);
  const toast = useToast();
  const acoes = useAcoes('b2b', toast);
  const ids = url.selecionados;
  const det = useDetalhamentoB2b(ids);
  // Prevalência é atributo do tema: o dicionário vem dos temas da turma no ciclo.
  const dicionario = useTemasTurmaB2b('ciclo');
  const alunos = useAlunosB2b('ciclo');
  const questoes = useQuestoesB2b(ids);

  return (
    <Moldura modalidade="b2b" simulados={simulados} url={url} toast={toast}>
      {(sel) => {
        const ultimo = sel[sel.length - 1];
        const idsSel = new Set(sel.map((s) => s.id));
        const participantes = alunos.data
          ? alunos.data.filter((a) => a.proficiencias.some((p) => idsSel.has(p.simuladoId) && p.valor !== null)).length
          : null;
        const areas = det.data?.areas;
        return (
          <Blocos
            modalidade="b2b"
            sel={sel}
            url={url}
            acoes={acoes}
            toast={toast}
            kpis={(
              <KpisDetalhamentoMentor
                modalidade="b2b"
                meta={det.meta ?? metaMentor({ periodo: `${rotuloRecorte(sel)} simulados`, criterio: 'Participantes dos simulados do recorte' })}
                estado={det.isError ? 'error' : det.isLoading ? 'loading' : 'ok'}
                acertoMedio={det.data?.acertoMedioPct ?? null}
                participantes={participantes}
                porSimulado={porSimuladoB2b(sel, det.data?.conceitoEnamed, det.data?.triProjetado, det.data?.proficientesPct ?? null)}
                totalTurma={null}
                onTentarNovamente={det.refetch}
              />
            )}
            matriz={{
              estado: det.isError || dicionario.isError ? 'error' : det.isLoading || dicionario.isLoading ? 'loading' : 'ok',
              dados: areas && dicionario.data
                ? matrizPrevalencia(temasComPrevalencia(areas, dicionario.data), areas.map((a) => a.grandeArea))
                : undefined,
              refetch: () => { det.refetch(); dicionario.refetch(); },
            }}
            areas={areas}
            areasCarregando={det.isLoading}
            alunos={(
              <VisaoAlunos
                modalidade="b2b"
                estado={estadoDe(alunos)}
                alunos={alunosVisaoB2b(alunos.data, ultimo.id)}
                multiSimulado={sel.length > 1}
                onAbrirAluno={url.abrirAluno}
                onTentarNovamente={alunos.refetch}
              />
            )}
            questoes={{ estado: estadoDe(questoes), lista: questoes.data ?? [], refetch: questoes.refetch }}
            acaoQuestoes={<LevarOficina simulado={ultimo} onToast={toast.mostrar} />}
            detalhe={(q, a) => <DetalheQuestaoB2b q={q} simuladoId={ultimo.id} acoes={a} />}
          />
        );
      }}
    </Moldura>
  );
}

/** Detalhamento por Simulados (docs/08 Fase 2): uma página, dados e textos por modalidade. */
export function DetalhamentoPagina({ modalidade }: { modalidade: Modalidade }) {
  return modalidade === 'b2b' ? <DetalhamentoB2b /> : <DetalhamentoB2c />;
}
