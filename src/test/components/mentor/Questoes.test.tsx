import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { aluno, SEM_DESEMPENHO } from './fixtures';
import type { AlunoTurma, ContagemQuestoes } from '@/services/mentor/turma';
import type { AlunoQuestoes } from '@/services/mentor/questoes';

const mocks = vi.hoisted(() => ({ questoes: vi.fn(), turma: vi.fn(), aluno: vi.fn() }));
vi.mock('@/services/mentor/questoes', async () => ({
  ...(await vi.importActual<typeof import('@/services/mentor/questoes')>('@/services/mentor/questoes')),
  fetchAlunoQuestoes: (email: string) => mocks.questoes(email),
}));
vi.mock('@/services/mentor/turma', () => ({ fetchTurma: () => mocks.turma(), fetchAluno: () => mocks.aluno() }));
vi.mock('@/services/mentor/contexto', () => ({ fetchMentorContexto: async () => ({ mentor: { nome: 'Ana', tipo: 'b2b', turma_nome: 'A' }, alunos_ativos: 1 }) }));
vi.mock('@/services/mentor/desempenho', async () => ({
  ...(await vi.importActual<typeof import('@/services/mentor/desempenho')>('@/services/mentor/desempenho')),
  fetchDesempenhoTurma: async () => SEM_DESEMPENHO,
}));
vi.mock('@/services/mentor/sessoes', () => ({ listarSessoes: async () => [] }));
vi.mock('@/services/mentor/intervencoes', () => ({ listarIntervencoes: async () => ({ cards: [] }) }));

import { descreverQuestoes, resumoQuestoesTurma, totalQuestoes7d, NOTA_SEM_QUESTOES_B2C, TOOLTIP_SEM_QUESTOES } from '@/features/mentor/components/turma/questoes';
import { CardQuestoesSemana, CelulaQuestoes7d } from '@/features/mentor/components/turma/QuestoesSemana';
import { SecaoQuestoesAluno } from '@/features/mentor/components/turma/SecaoQuestoesAluno';
import MinhaTurma from '@/features/mentor/routes/MinhaTurma';

const contagem = (respondidas = 12, acertos = 9, erros = 3, pct_acerto: number | null = 75): ContagemQuestoes => ({ respondidas, acertos, erros, pct_acerto });
const comDado = (c = contagem()): AlunoTurma => aluno({ email: 'a@x.com', nome: 'Alice', b2b: true, tem_dado_questoes: true, questoes_7d: c, questoes_30d: contagem(40, 30, 10) });
const semDado = () => aluno({ email: 'b@x.com', questoes_7d: contagem(100, 100, 0, 100) });
const dados: AlunoQuestoes = {
  email: 'a@x.com', tem_dado_questoes: true, ultima_resposta: '2026-10-20T12:00:00Z',
  por_semana: Array.from({ length: 8 }, (_, i) => ({ semana: `2026-09-${String(i + 1).padStart(2, '0')}`, respondidas: 4, acertos: 3, erros: 1 })),
  por_area: [{ area: 'A'.repeat(80), respondidas: 12, acertos: 9, erros: 3, pct_acerto: 75 }, { area: 'Sem classificação', respondidas: 0, acertos: 0, erros: 0, pct_acerto: null }],
};

function renderCom(ui: React.ReactElement, cache?: AlunoTurma[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (cache) client.setQueryData(['mentor', 'turma'], cache);
  return render(<QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.questoes.mockResolvedValue(dados);
  mocks.turma.mockResolvedValue([comDado()]);
  mocks.aluno.mockResolvedValue({ aluno: null, liberacao: null, intervencoes: [], log: [] });
});

describe('helpers de questões', () => {
  it('não confunde fonte ausente com zero', () => {
    expect(totalQuestoes7d(semDado())).toBeNull();
    expect(totalQuestoes7d(comDado(contagem(0, 0, 0, null)))).toBe(0);
    expect(resumoQuestoesTurma([semDado()])).toEqual({ comDado: 0, media: null, pctAcerto: null });
    expect(resumoQuestoesTurma([comDado(contagem(0, 0, 0, null))])).toEqual({ comDado: 1, media: 0, pctAcerto: null });
  });
  it('ignora alunos sem fonte e pondera pelo total corrigido', () => {
    expect(resumoQuestoesTurma([comDado(contagem(10, 9, 1, 90)), comDado(contagem(30, 15, 15, 50)), semDado()]))
      .toEqual({ comDado: 2, media: 20, pctAcerto: 60 });
  });
  it('descreve singular, plural, zero, sem correção e percentual pt-BR', () => {
    expect(descreverQuestoes(contagem(1, 1, 0, 100))).toBe('1 questão · 100% de acerto');
    expect(descreverQuestoes(contagem())).toBe('12 questões · 75% de acerto');
    expect(descreverQuestoes(contagem(0, 0, 0, null))).toBe('0 questões');
    expect(descreverQuestoes(contagem(3, 0, 0, null))).toBe('3 questões · sem correção');
    expect(descreverQuestoes(contagem(12480, 0, 0, 75.5))).toBe('12.480 questões · 75,5% de acerto');
  });
});

describe('célula e card', () => {
  it('mostra traço sem fonte e mantém o gatilho focável', () => {
    renderCom(<CelulaQuestoes7d aluno={semDado()} />);
    expect(screen.getByTestId('questoes-7d')).toHaveTextContent('–');
    expect(screen.getByTestId('questoes-7d')).toHaveAttribute('tabindex', '0');
  });
  it('formata contagens grandes em pt-BR', () => {
    renderCom(<CelulaQuestoes7d aluno={comDado(contagem(12480))} />);
    expect(screen.getByTestId('questoes-7d')).toHaveTextContent('12.480');
  });
  it('mostra nota B2C sem fonte', () => {
    renderCom(<CardQuestoesSemana alunos={[semDado()]} />);
    expect(screen.getByTestId('card-questoes-valor')).toHaveTextContent('–');
    expect(screen.getByTestId('card-questoes')).toHaveTextContent(NOTA_SEM_QUESTOES_B2C);
  });
  it('mostra média, percentual e alunos com fonte', () => {
    renderCom(<CardQuestoesSemana alunos={[comDado(), semDado()]} />);
    expect(screen.getByTestId('card-questoes-valor')).toHaveTextContent('12');
    expect(screen.getByTestId('card-questoes')).toHaveTextContent('75% de acerto · 1 aluno com dado');
  });
  it('zero com fonte não exibe percentual inventado', () => {
    renderCom(<CardQuestoesSemana alunos={[comDado(contagem(0, 0, 0, null))]} />);
    expect(screen.getByTestId('card-questoes-valor')).toHaveTextContent('0');
    expect(screen.getByTestId('card-questoes')).not.toHaveTextContent('%');
  });
});

describe('seção do drawer', () => {
  it('carrega sob demanda pelo email', () => {
    mocks.questoes.mockReturnValue(new Promise(() => {}));
    renderCom(<SecaoQuestoesAluno aluno={comDado()} />);
    expect(screen.getByText('Carregando questões…')).toBeInTheDocument();
    expect(mocks.questoes).toHaveBeenCalledWith('a@x.com');
  });
  it('permite tentar de novo após erro', async () => {
    mocks.questoes.mockRejectedValueOnce(new Error('falhou')).mockResolvedValue(dados);
    renderCom(<SecaoQuestoesAluno aluno={comDado()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    await screen.findByTestId('questoes-por-area');
    expect(mocks.questoes).toHaveBeenCalledTimes(2);
  });
  it.each([true, false])('sem fonte, b2b=%s', async (b2b) => {
    mocks.questoes.mockResolvedValue({ ...dados, tem_dado_questoes: false, por_semana: [], por_area: [] });
    renderCom(<SecaoQuestoesAluno aluno={{ ...semDado(), b2b }} />);
    expect(await screen.findByText(b2b ? `${TOOLTIP_SEM_QUESTOES}.` : NOTA_SEM_QUESTOES_B2C)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('mostra totais, gráfico acessível, legenda, áreas e última resposta', async () => {
    renderCom(<SecaoQuestoesAluno aluno={comDado()} />);
    const lista = await screen.findByTestId('questoes-por-area');
    expect(screen.getByTestId('questoes-total-7d')).toHaveTextContent('12');
    expect(screen.getByTestId('questoes-total-30d')).toHaveTextContent('40');
    expect(screen.getByRole('img', { name: 'Últimas 8 semanas: 32 questões, 75% de acerto' })).toBeInTheDocument();
    expect(screen.getByText('Acertos')).toBeInTheDocument();
    expect(screen.getByText('Erros')).toBeInTheDocument();
    expect(within(lista).getAllByRole('listitem').at(-1)).toHaveTextContent('Sem classificação');
    expect(screen.getByText('A'.repeat(80))).toHaveClass('min-w-0', 'truncate');
    expect(lista).toHaveTextContent('12 · 75%');
    expect(screen.getByText(/Última resposta/)).toBeInTheDocument();
  });
  it('recupera totais do cache da turma sem diferenciar maiúsculas', async () => {
    renderCom(<SecaoQuestoesAluno aluno={aluno({ email: 'A@X.COM' })} />, [comDado()]);
    await screen.findByTestId('questoes-por-area');
    expect(screen.getByTestId('questoes-total-7d')).toHaveTextContent('12');
  });
  it('zero com fonte mantém totais sem percentual', async () => {
    renderCom(<SecaoQuestoesAluno aluno={comDado(contagem(0, 0, 0, null))} />);
    await screen.findByTestId('questoes-por-area');
    expect(screen.getByTestId('questoes-total-7d')).toHaveTextContent('0');
    expect(screen.getByTestId('questoes-total-7d')).not.toHaveTextContent('%');
  });
});

describe('integrações', () => {
  it('Minha Turma tem coluna e card de questões', async () => {
    renderCom(<MinhaTurma />);
    expect(await screen.findByRole('columnheader', { name: 'Questões (7d)' })).toBeInTheDocument();
    expect(screen.getByText('Questões na semana')).toBeInTheDocument();
  });
});
