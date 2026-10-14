import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aluno, comConsumo, semConsumo, SEM_DESEMPENHO } from './fixtures';

const fetchMentorContexto = vi.fn();
const fetchTurma = vi.fn();
const fetchAluno = vi.fn();
const fetchDesempenhoTurma = vi.fn();
const fetchAlunoNotas = vi.fn();
const fetchAlunoConteudos = vi.fn();
vi.mock('@/services/mentor/contexto', () => ({ fetchMentorContexto: () => fetchMentorContexto() }));
vi.mock('@/services/mentor/turma', () => ({
  fetchTurma: () => fetchTurma(),
  fetchAluno: (e: string) => fetchAluno(e),
}));
vi.mock('@/services/mentor/desempenho', async () => ({
  ...(await vi.importActual<typeof import('@/services/mentor/desempenho')>('@/services/mentor/desempenho')),
  fetchDesempenhoTurma: (...a: unknown[]) => fetchDesempenhoTurma(...a),
  fetchAlunoNotas: (e: string) => fetchAlunoNotas(e),
}));
vi.mock('@/services/mentor/conteudos', async () => ({
  ...(await vi.importActual<typeof import('@/services/mentor/conteudos')>('@/services/mentor/conteudos')),
  fetchAlunoConteudos: (e: string) => fetchAlunoConteudos(e),
}));
vi.mock('@/services/mentor/sessoes', () => ({
  liberarAgenda: vi.fn(),
  desligarAgenda: vi.fn(),
  listarSessoes: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/mentor/intervencoes', () => ({
  listarIntervencoes: vi.fn().mockResolvedValue({ cards: [], planejadas: 0, realizadas: 0 }),
}));

import MinhaTurma from '@/features/mentor/routes/MinhaTurma';
import InicioMentor from '@/features/mentor/routes/InicioMentor';
import { DrawerAlunoMentor } from '@/features/mentor/components/DrawerAlunoMentor';

const T = { timeout: 3000 };
const NOTA_B2C = 'Consumo de conteúdo ainda não chega para alunos B2C';

function renderCom(ui: React.ReactElement, url = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMentorContexto.mockResolvedValue({
    mentor: { nome: 'Ana Souza', tipo: 'b2c', turma_nome: 'Turma A' },
    alunos_ativos: 3,
  });
  fetchDesempenhoTurma.mockResolvedValue(SEM_DESEMPENHO);
  fetchAlunoNotas.mockResolvedValue({ email: '', notas: [], areas: [] });
  fetchAluno.mockResolvedValue({ aluno: null, liberacao: null, intervencoes: [], log: [] });
});

function linhaDe(nome: string): HTMLElement {
  return screen.getByText(nome).closest('tr') as HTMLElement;
}

describe('Minha Turma: conteúdos', () => {
  it('turma mista: coluna mostra total, "–" sem dado, e a média só conta quem tem dado', async () => {
    fetchTurma.mockResolvedValue([
      comConsumo('a@x.com', 'Alice Com', 4, 2), // 6
      comConsumo('b@x.com', 'Bruno Zero', 0, 0), // 0 (tem dado, não consumiu)
      semConsumo('c@x.com', 'Carla Sem'),
    ]);
    renderCom(<MinhaTurma />, '/mentor/turma');
    await screen.findByText('Alice Com', undefined, T);

    expect(screen.getByRole('columnheader', { name: 'Conteúdos (7d)' })).toBeInTheDocument();
    expect(within(linhaDe('Alice Com')).getByTestId('conteudos-7d')).toHaveTextContent('6');
    expect(within(linhaDe('Bruno Zero')).getByTestId('conteudos-7d')).toHaveTextContent('0');
    expect(within(linhaDe('Carla Sem')).getByTestId('conteudos-7d')).toHaveTextContent('–');

    // Média = (6 + 0) / 2 = 3, ignorando a Carla (sem dado não é zero).
    const card = screen.getByTestId('card-conteudos');
    expect(card).toHaveTextContent('Conteúdos na semana');
    expect(screen.getByTestId('card-conteudos-valor')).toHaveTextContent('3');
    expect(card).toHaveTextContent('vídeos e documentos · 2 alunos com dado');
    expect(card).not.toHaveTextContent(NOTA_B2C);
  });

  it('tooltip com dado: "N vídeos · M documentos"', async () => {
    const user = userEvent.setup();
    fetchTurma.mockResolvedValue([comConsumo('a@x.com', 'Alice Com', 4, 1), semConsumo('c@x.com', 'Carla Sem')]);
    renderCom(<MinhaTurma />, '/mentor/turma');
    await screen.findByText('Alice Com', undefined, T);
    await user.hover(within(linhaDe('Alice Com')).getByTestId('conteudos-7d'));
    expect((await screen.findByRole('tooltip', undefined, T)).textContent).toBe('4 vídeos · 1 documento');
  });

  it('tooltip sem dado: "Sem dado de consumo para este aluno"', async () => {
    const user = userEvent.setup();
    fetchTurma.mockResolvedValue([comConsumo('a@x.com', 'Alice Com', 4, 1), semConsumo('c@x.com', 'Carla Sem')]);
    renderCom(<MinhaTurma />, '/mentor/turma');
    await screen.findByText('Alice Com', undefined, T);
    await user.hover(within(linhaDe('Carla Sem')).getByTestId('conteudos-7d'));
    expect(await screen.findByRole('tooltip', undefined, T)).toHaveTextContent('Sem dado de consumo para este aluno');
  });

  it('turma toda B2C: card "–" com a nota, e cada linha com "–"', async () => {
    fetchTurma.mockResolvedValue([semConsumo('a@x.com', 'Alice Sem'), semConsumo('c@x.com', 'Carla Sem')]);
    renderCom(<MinhaTurma />, '/mentor/turma');
    await screen.findByText('Alice Sem', undefined, T);

    const card = screen.getByTestId('card-conteudos');
    expect(screen.getByTestId('card-conteudos-valor')).toHaveTextContent('–');
    expect(card).toHaveTextContent(NOTA_B2C);
    for (const nome of ['Alice Sem', 'Carla Sem']) {
      expect(within(linhaDe(nome)).getByTestId('conteudos-7d')).toHaveTextContent('–');
    }
  });

  it('backend ainda sem os campos: trata como sem dado, nunca 0', async () => {
    fetchTurma.mockResolvedValue([aluno({ email: 'a@x.com', nome: 'Alice Legada', segmento: 'ativo', dias_sem_atividade: 1 })]);
    renderCom(<MinhaTurma />, '/mentor/turma');
    await screen.findByText('Alice Legada', undefined, T);
    expect(within(linhaDe('Alice Legada')).getByTestId('conteudos-7d')).toHaveTextContent('–');
    expect(screen.getByTestId('card-conteudos')).toHaveTextContent(NOTA_B2C);
  });
});

describe('Início: conteúdos', () => {
  it('mostra "Conteúdos na semana" só quando alguém tem dado', async () => {
    fetchTurma.mockResolvedValue([comConsumo('a@x.com', 'Alice Com', 5, 1), semConsumo('c@x.com', 'Carla Sem')]);
    const { unmount } = renderCom(<InicioMentor />, '/mentor');
    const card = await screen.findByTestId('card-conteudos', undefined, T);
    expect(screen.getByTestId('card-conteudos-valor')).toHaveTextContent('6');
    expect(card).toHaveTextContent('1 aluno com dado');
    unmount();

    fetchTurma.mockResolvedValue([semConsumo('c@x.com', 'Carla Sem')]);
    renderCom(<InicioMentor />, '/mentor');
    await screen.findByText(/Sumiram/, undefined, T);
    await screen.findByText('Ninguém sumiu. Sua turma está em dia.', undefined, T);
    expect(screen.queryByTestId('card-conteudos')).not.toBeInTheDocument();
  });
});

describe('Drawer do aluno: conteúdos', () => {
  const segundas = ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'];
  const semanas = segundas.map((semana, i) => ({ semana, videos: i, documentos: 1 }));
  const recentes = Array.from({ length: 12 }, (_, i) => ({
    quando: new Date(Date.UTC(2026, 9, 13, 12 - Math.floor(i / 2), 0, 0)).toISOString(),
    tipo: i % 2 === 0 ? ('video' as const) : ('document' as const),
    conteudo: `Conteúdo ${i + 1}`,
    curso: 'Cardiologia',
    modulo: `Módulo ${i + 1}`,
  }));
  const comDados = {
    email: 'a@x.com',
    tem_dado_consumo: true,
    por_semana: semanas,
    recentes,
    top_cursos: [
      { curso: 'Cardiologia', total: 14 },
      { curso: 'Pneumologia', total: 9 },
    ],
  };

  function detalhe(b2b: boolean) {
    return {
      aluno: comConsumo('a@x.com', 'Alice Souza', 4, 2, { b2b }),
      liberacao: null,
      intervencoes: [],
      log: [],
    };
  }

  function renderDrawer(open = true) {
    return renderCom(<DrawerAlunoMentor email="a@x.com" open={open} onOpenChange={() => {}} />);
  }

  it('renderiza totais, sparkline, top cursos e recentes; "ver mais" expande até 20', async () => {
    fetchAluno.mockResolvedValue(detalhe(true));
    fetchAlunoConteudos.mockResolvedValue(comDados);
    renderDrawer();
    const secao = await screen.findByTestId('secao-conteudos', undefined, T);
    expect(await within(secao).findByTestId('conteudos-sparkline', undefined, T)).toHaveAttribute(
      'aria-label',
      'Últimas 8 semanas: 28 vídeos e 8 documentos',
    );
    expect(fetchAlunoConteudos).toHaveBeenCalledWith('a@x.com');

    expect(within(secao).getByTestId('conteudos-total-7d')).toHaveTextContent('6');
    expect(within(secao).getByTestId('conteudos-total-7d')).toHaveTextContent('4 vídeos · 2 documentos');
    expect(within(secao).getByTestId('conteudos-total-30d')).toHaveTextContent('16');

    const top = within(secao).getByTestId('conteudos-top-cursos');
    expect(within(top).getAllByRole('listitem')).toHaveLength(2);
    expect(top).toHaveTextContent('Cardiologia');
    expect(top).toHaveTextContent('14');

    const lista = within(secao).getByTestId('conteudos-recentes');
    expect(within(lista).getAllByRole('listitem')).toHaveLength(5);
    expect(lista).toHaveTextContent('Conteúdo 1');
    expect(lista).toHaveTextContent('Cardiologia · Módulo 1');
    expect(within(lista).queryByText('Conteúdo 6')).not.toBeInTheDocument();

    fireEvent.click(within(secao).getByRole('button', { name: 'ver mais' }));
    expect(within(lista).getAllByRole('listitem')).toHaveLength(12);
    fireEvent.click(within(secao).getByRole('button', { name: 'ver menos' }));
    expect(within(lista).getAllByRole('listitem')).toHaveLength(5);
  });

  it('só busca com o drawer aberto', async () => {
    fetchAluno.mockResolvedValue(detalhe(true));
    fetchAlunoConteudos.mockResolvedValue(comDados);
    renderDrawer(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchAluno).not.toHaveBeenCalled();
    expect(fetchAlunoConteudos).not.toHaveBeenCalled();
  });

  it('sem dado: uma linha muda, sem gráfico nem zeros (B2C e B2B)', async () => {
    fetchAlunoConteudos.mockResolvedValue({
      email: 'a@x.com',
      tem_dado_consumo: false,
      por_semana: [],
      recentes: [],
      top_cursos: [],
    });
    fetchAluno.mockResolvedValue(detalhe(false));
    const { unmount } = renderDrawer();
    expect(await screen.findByTestId('conteudos-sem-dado', undefined, T)).toHaveTextContent(NOTA_B2C);
    expect(screen.queryByTestId('conteudos-sparkline')).not.toBeInTheDocument();
    expect(screen.queryByTestId('conteudos-total-7d')).not.toBeInTheDocument();
    unmount();

    fetchAluno.mockResolvedValue(detalhe(true));
    renderDrawer();
    expect(await screen.findByTestId('conteudos-sem-dado', undefined, T)).toHaveTextContent(
      'Sem dado de consumo para este aluno.',
    );
  });

  it('erro da RPC mostra aviso com retry', async () => {
    fetchAluno.mockResolvedValue(detalhe(true));
    fetchAlunoConteudos.mockRejectedValue(new Error('boom'));
    renderDrawer();
    expect(await screen.findByText('Não foi possível carregar os conteúdos.', undefined, T)).toBeInTheDocument();
  });
});
