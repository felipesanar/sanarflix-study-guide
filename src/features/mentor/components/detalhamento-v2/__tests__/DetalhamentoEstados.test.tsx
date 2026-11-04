/**
 * Estados do Detalhamento com os hooks controlados: carregando, erro, sem simulado, prevalência vazia,
 * `null` como "—", diagnóstico gerando/erro. A camada de dados é mockada no módulo `api/queries`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AcertoArea, DesempenhoTurmaB2c, PontoSerieTurma, SimuladoMentor, TemaTurmaMentor } from '@/features/mentor/api/types';
import { DetalhamentoPagina } from '../DetalhamentoPagina';

vi.mock('react-router-dom', async () => vi.importActual('react-router-dom'));
vi.mock('@/features/gestor/hooks/useCountUp', () => ({ useCountUp: (v: number | null) => v }));

const ok = <T,>(data: T) => ({ data, meta: undefined, isLoading: false, isError: false, isFetching: false, isPlaceholderData: false, error: null, refetch: vi.fn() });
const carregando = () => ({ ...ok(undefined), isLoading: true });
const erro = () => ({ ...ok(undefined), isError: true });

const sim = (ordem: number, status: SimuladoMentor['status'] = 'realizado'): SimuladoMentor =>
  ({ id: `s${ordem}`, ordem, nome: `${ordem}º Simulado PRO`, data: '2026-09-21T12:00:00Z', status, participantes: null });
const serie: PontoSerieTurma[] = [
  { simuladoId: 's4', ordem: 4, titulo: null, fechado: true, participantes: 70, acertoMedio: 77, acimaCortePct: null },
  { simuladoId: 's5', ordem: 5, titulo: null, fechado: true, participantes: 62, acertoMedio: null, acimaCortePct: null },
];
const desempenho = { alunos: [], possivelAprovacaoPct: null, acertoMedioUltimo: null, simulados: [], participacaoUltimo: { simuladoId: 's5', fizeram: 0, total: 87 } } as DesempenhoTurmaB2c;
const areas: AcertoArea[] = [{ grandeArea: 'Preventiva', acertoPct: 58, respostas: 300, temas: [], especialidades: [{ especialidade: 'Epidemiologia', acertoPct: null, respostas: 0, temas: [] }] }];
const temaSemPrev: TemaTurmaMentor = { id: 't', tema: 'Vigilância', especialidade: null, grandeArea: 'Preventiva', prevalencia: null, peso: null, respostas: 40, acertoPct: 50, alunosAbaixo50: [], critico: true, serie: [] };

const h = vi.hoisted(() => ({ estado: {} as Record<string, unknown>, ia: {} as Record<string, unknown> }));
vi.mock('@/features/mentor/api/queries', () => {
  const pegar = (k: string) => () => h.estado[k];
  return {
    useSimuladosMentor: pegar('simulados'),
    useSerieTurma: pegar('serie'),
    useDesempenhoTurma: pegar('desempenho'),
    useTemasTurma: pegar('temas'),
    useDetalhamento: pegar('det'),
    useTurmaAcademy: pegar('turma'),
    useQuestao: pegar('questao'),
    useCronogramaB2b: pegar('simulados'),
    useDetalhamentoB2b: pegar('det'),
    useTemasTurmaB2b: pegar('temas'),
    useAlunosB2b: pegar('alunosB2b'),
    useQuestoesB2b: pegar('questoesB2b'),
    useRespondentesB2b: pegar('respondentes'),
    useSessoes: () => ({ data: { data: [] }, isLoading: false }),
    useEditarSessao: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRegistrarEvento: () => ({ mutateAsync: vi.fn(async () => ({ intervencaoId: 'c1', duplicado: false })), isPending: false }),
  };
});
vi.mock('../useDiagnosticoIa', () => ({ useDiagnosticoIa: () => h.ia }));

function padrao() {
  h.estado = {
    simulados: ok([sim(4), sim(5), sim(6, 'agendado')]),
    serie: ok(serie),
    desempenho: ok(desempenho),
    temas: ok([temaSemPrev]),
    det: ok({ areas, questoes: [], bloqueados: [] }),
    turma: ok([]),
    alunosB2b: ok([]),
    questoesB2b: ok([]),
    respondentes: ok([]),
  };
  h.ia = { data: { resumo: 'Resumo da IA.', itens: [{ destaque: 'Um.', texto: 'dois' }], geradoEm: null }, gerando: false, erro: null, gerarDeNovo: vi.fn(), tentarNovamente: vi.fn() };
}

function montar(modalidade: 'b2c' | 'b2b' = 'b2c', rota = '/mentor/detalhamento') {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[rota]}><DetalhamentoPagina modalidade={modalidade} /></MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(padrao);

describe('Detalhamento · estados', () => {
  it('carregando: skeleton na anatomia, título e "Ver cronograma" visíveis', () => {
    h.estado.simulados = carregando();
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Detalhamento de simulados' })).toBeInTheDocument();
    expect(screen.getByTestId('detalhamento-carregando')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver cronograma/ })).toBeInTheDocument();
  });

  it('erro dos simulados: EstadoErro com "Tentar novamente" que refaz a busca', async () => {
    const user = userEvent.setup();
    const e = erro();
    h.estado.simulados = e;
    montar();
    await user.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(e.refetch).toHaveBeenCalled();
  });

  it('sem simulado realizado: "Nenhum simulado disponível" e nada do resto', () => {
    h.estado.simulados = ok([sim(6, 'agendado')]);
    montar();
    expect(screen.getByTestId('sem-simulado')).toHaveTextContent('Nenhum simulado disponível');
    expect(screen.queryByTestId('seletor-simulados')).not.toBeInTheDocument();
  });

  it('prevalência vazia: estado próprio, sem quebrar o resto; "Detalhar" continua abrindo o drawer', async () => {
    const user = userEvent.setup();
    montar();
    expect(screen.getByTestId('prevalencia-vazia')).toHaveTextContent('Prevalência ainda não cadastrada');
    expect(screen.queryByTestId('prevalencia-coluna-alta')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Diagnóstico da IA' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Detalhar Preventiva' }));
    const drawer = await screen.findByRole('dialog');
    // null nunca vira zero.
    expect(within(drawer).getByTestId('especialidade-Epidemiologia')).toHaveTextContent('—');
  });

  it('null vira "—" nos indicadores e não gera delta com um só ponto válido', () => {
    montar('b2c', '/mentor/detalhamento?s=4,5');
    const ap = screen.getByTestId('kpi-possivel-aprovacao');
    expect(within(ap).getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(within(ap).queryByTestId('kpi-delta')).not.toBeInTheDocument();
    // acerto médio só com o ponto válido (4º): 77%.
    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-valor')).toHaveTextContent('77');
  });

  it('erro de um bloco fica contido no bloco (questões), com "Tentar novamente"', () => {
    h.estado.det = erro();
    montar();
    expect(within(screen.getByTestId('bloco-questoes')).getByText('Não foi possível carregar as questões.')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-acerto-medio')).toBeInTheDocument();
  });

  it('IA gerando: 3 linhas de skeleton com role=status; erro: mensagem e "Tentar novamente"', async () => {
    h.ia = { ...h.ia, gerando: true };
    const { unmount } = montar();
    expect(screen.getByTestId('ia-gerando')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Levar pro mural' })).toBeDisabled();
    unmount();
    const tentar = vi.fn();
    h.ia = { ...h.ia, gerando: false, erro: new Error('x'), tentarNovamente: tentar };
    montar();
    const bloco = screen.getByTestId('bloco-diagnostico-ia');
    await userEvent.setup().click(within(bloco).getByRole('button', { name: 'Tentar novamente' }));
    expect(tentar).toHaveBeenCalled();
  });

  it('questões vazias com filtro de área: vazio com "Limpar filtro"', () => {
    montar('b2c', '/mentor/detalhamento?s=4,5&area=Cirurgia');
    expect(within(screen.getByTestId('bloco-questoes')).getByText('Nenhuma questão desta grande área no recorte.')).toBeInTheDocument();
    expect(within(screen.getByTestId('bloco-questoes')).getByRole('button', { name: 'Limpar filtro' })).toBeInTheDocument();
  });

  it('B2B: indicadores com badge "projetado" e nota do agregado do período', () => {
    h.estado.det = ok({
      areas, questoes: [], bloqueados: [], acertoMedioPct: 61.1, proficientesPct: 52,
      conceitoEnamed: { valor: 3, delta: 0, serie: [] }, triProjetado: { valor: 58.4, delta: 1.2, serie: [] },
    });
    montar('b2b');
    expect(screen.getAllByText('projetado')).toHaveLength(2);
    expect(within(screen.getByTestId('kpi-tri-projetado')).getByTestId('kpi-delta')).toHaveTextContent('1,2');
    expect(screen.getByText(/o agregado do período é a Visão Geral/)).toBeInTheDocument();
  });
});
