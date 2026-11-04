import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useRoutes } from 'react-router-dom';
import type { MeFlix } from '@/features/mentor/api/fonte';
import { useMe, useContagensNav } from '@/features/mentor/api/queries';
import { mentorRoutes } from '@/features/mentor/mentorRoutes';
import { MentorShell } from '@/features/mentor/shell/MentorShell';
import { GuardPortalMentor } from '@/features/mentor/shell/GuardPortalMentor';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/mentor/api/queries', () => ({ useMe: vi.fn(), useContagensNav: vi.fn() }));
// O shell testa roteamento: cada tela vira um stub com o mesmo título (as telas têm testes próprios).
const telaStub = (titulo: string, testId: string) => ({ default: () => <h1 data-testid={testId}>{titulo}</h1> });
vi.mock('@/features/mentor/routes/v2/Inicio', () => telaStub('Início', 'mentor-inicio'));
vi.mock('@/features/mentor/routes/v2/MinhaTurma', () => telaStub('Minha Turma', 'mentor-minha-turma'));
vi.mock('@/features/mentor/routes/v2/VisaoGeral', () => telaStub('Visão Geral', 'mentor-visao-geral'));
vi.mock('@/features/mentor/routes/v2/Detalhamento', () => telaStub('Detalhamento por Simulados', 'mentor-detalhamento'));
vi.mock('@/features/mentor/routes/v2/Mural', () => telaStub('Mural', 'mentor-mural'));
vi.mock('@/features/mentor/routes/v2/Sessoes', () => telaStub('Sessões', 'mentor-sessoes'));
vi.mock('@/features/mentor/routes/v2/Canais', () => telaStub('Canais', 'mentor-canais'));
vi.mock('@/features/mentor/routes/v2/Intervencoes', () => telaStub('Intervenções', 'mentor-intervencoes'));
vi.mock('@/experiences/shared/ExperienceGuard', () => ({
  ExperienceGuard: ({ children, experience }: { children: React.ReactNode; experience: string }) => (
    <div data-testid="experience-guard" data-experience={experience}>{children}</div>
  ),
}));
// A tela real do Início (T5) busca os próprios dados; o teste do shell só precisa do marcador da rota.
vi.mock('@/features/mentor/routes/v2/Inicio', () => ({
  default: () => <h1 data-testid="mentor-inicio">Início</h1>,
}));
vi.mock('@/features/mentor/components/aluno/DrawerAlunoHost', () => ({
  DrawerAlunoHost: () => {
    const container = useGestorPortalContainer();
    return <span data-testid="drawer-aluno-host" data-container={container?.className} />;
  },
}));

const refetchMe = vi.fn();
const refetchContagens = vi.fn();
function me(modalidade: 'b2c' | 'b2b' = 'b2c'): MeFlix {
  return {
    portalMentor: true,
    mentor: { id: 'm1', nome: 'Ana Souza', fotoUrl: '/ana.png', agendaUrl: null, modalidade },
    tribos: [{
      id: 't1', nome: modalidade === 'b2c' ? 'Carcará' : 'UniAtenas', slug: modalidade === 'b2c' ? 'carcara' : 'uniatenas',
      modalidade, papel: 'titular', iconeUrl: '/icone-contexto.png',
      iesNome: modalidade === 'b2b' ? 'UniAtenas' : null, campus: 'Paracatu', totalAlunos: 186,
    }],
  };
}
function mockMe(data: MeFlix | undefined, extra = {}) {
  vi.mocked(useMe).mockReturnValue({
    data, isPending: false, isLoading: false, isError: false, isFetching: false, refetch: refetchMe, ...extra,
  } as unknown as ReturnType<typeof useMe>);
}
function mockContagens(intervencoesAFazer: number | null = null, canaisPendentes: number | null = null, extra = {}) {
  vi.mocked(useContagensNav).mockReturnValue({
    data: { intervencoesAFazer, canaisPendentes }, isError: false, isFetching: false,
    refetch: refetchContagens, ...extra,
  } as unknown as ReturnType<typeof useContagensNav>);
}
function Localizacao() {
  return <output data-testid="localizacao">{useLocation().pathname}</output>;
}
function Rotas() {
  return useRoutes([...mentorRoutes(), { path: '/', element: <h1>Home</h1> }]);
}
function renderRotas(path = '/mentor') {
  return render(<MemoryRouter initialEntries={[path]}><Rotas /><Localizacao /></MemoryRouter>);
}
function renderShell(path = '/mentor') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route element={<GuardPortalMentor><MentorShell /></GuardPortalMentor>}>
        <Route path="/mentor/*" element={<h1>Conteúdo disponível</h1>} />
      </Route></Routes>
    </MemoryRouter>,
  );
}

function mostrarLayoutMobile() {
  // JSDOM não avalia media queries; reproduz a visibilidade do breakpoint mobile.
  document.querySelector<HTMLElement>('.mentor-header-mobile')!.style.display = 'flex';
  document.querySelector<HTMLElement>('.mentor-sidebar')!.style.display = 'none';
}

beforeEach(() => {
  mockMe(me());
  mockContagens();
});

describe('Shell do mentor', () => {
  it('usa tema e container do Gestor, lockup, identidade B2C e monta o host uma única vez', () => {
    const { container } = renderShell();
    expect(container.querySelector('.gestor-portal.mentor-portal')).not.toBeNull();
    const sidebar = screen.getByTestId('mentor-sidebar');
    expect(within(sidebar).getByAltText('SanarFlix Academy')).toHaveAttribute('src', '/sanarflix-academy-lockup.svg');
    expect(within(sidebar).getByText('Tribo Carcará')).toBeVisible();
    expect(within(sidebar).getByText('Nota 90+')).toBeVisible();
    expect(within(sidebar).getByTestId('cartao-contexto')).toHaveStyle({ background: '#3A1405' });
    expect(within(sidebar).getByAltText('Ícone da tribo Carcará')).toHaveAttribute('src', '/icone-contexto.png');
    expect(within(sidebar).getByAltText('Ana Souza')).toHaveStyle({ boxShadow: '0 0 0 2px #D9771F' });
    expect(within(sidebar).getByText('Mentor B2C')).toBeVisible();
    expect(within(sidebar).getByRole('button', { name: 'Notificações' })).toBeInTheDocument();
    expect(screen.queryByText('Notas de handoff')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('drawer-aluno-host')).toHaveLength(1);
    expect(screen.getByTestId('drawer-aluno-host')).toHaveAttribute('data-container', 'gestor-portal mentor-portal');
  });

  it('marca apenas a rota ativa e usa o texto literal do protótipo', () => {
    renderShell('/mentor/detalhamento');
    const nav = within(screen.getByTestId('mentor-sidebar')).getByRole('navigation');
    expect(within(nav).getAllByRole('link')).toHaveLength(6);
    expect(within(nav).getByText('Minha mentoria')).toBeInTheDocument();
    const ativo = within(nav).getByRole('link', { name: 'Detalhamento por Simulados' });
    expect(ativo).toHaveAttribute('aria-current', 'page');
    expect(ativo).toHaveClass('mentor-nav-link');
    expect(within(nav).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
  });

  it.each([null, 0, -1])('não transforma contagem %s em badge', (quantidade) => {
    mockContagens(quantidade, quantidade);
    mockMe(me('b2b'));
    renderShell();
    expect(screen.queryByTestId('badge-intervencoesAFazer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('badge-canaisPendentes')).not.toBeInTheDocument();
  });

  it('B2B tem nav própria, ícone da IES, alunos e iniciais no perfil', () => {
    mockMe(me('b2b'));
    mockContagens(3, 1);
    renderShell();
    const sidebar = screen.getByTestId('mentor-sidebar');
    expect(within(sidebar).getByText('UniAtenas · Paracatu')).toBeInTheDocument();
    expect(within(sidebar).getByText('Sua turma · 186 alunos')).toBeInTheDocument();
    expect(within(sidebar).getByAltText('Ícone da IES UniAtenas')).toBeInTheDocument();
    expect(within(sidebar).getByText('AS')).toBeInTheDocument();
    expect(within(sidebar).queryByAltText('Ana Souza')).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: /Visão Geral/ })).toHaveAttribute('href', '/mentor/visao-geral');
    expect(within(sidebar).getByRole('link', { name: /Canais/ })).toHaveAttribute('href', '/mentor/canais');
    expect(within(sidebar).queryByRole('link', { name: 'Mural' })).not.toBeInTheDocument();
    expect(screen.getByTestId('badge-intervencoesAFazer')).toHaveTextContent('3');
    expect(screen.getByTestId('badge-canaisPendentes')).toHaveTextContent('1');
  });

  it('não exibe contagens antigas quando a consulta de badges falha', () => {
    mockContagens(3, 1, { isError: true });
    renderShell();
    expect(screen.queryByTestId('badge-intervencoesAFazer')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetchContagens).toHaveBeenCalledOnce();
    expect(refetchMe).not.toHaveBeenCalled();
  });

  it('não inventa alunos ou uma tribo conhecida para um contexto ausente/desconhecido', () => {
    const data = me();
    data.tribos = [{ ...data.tribos[0], slug: 'nova-tribo', nome: 'Nova', totalAlunos: null }];
    mockMe(data);
    renderShell();
    expect(screen.queryByText('Nota 90+')).not.toBeInTheDocument();
    expect(screen.getAllByText('Tribo Nova').length).toBeGreaterThan(0);
  });
});

describe('Header e drawer mobile', () => {
  it('abre, prende foco com Tab e Shift+Tab, fecha com Esc e devolve foco ao gatilho', async () => {
    const user = userEvent.setup();
    renderShell();
    mostrarLayoutMobile();
    const gatilho = screen.getByRole('button', { name: 'Abrir menu' });
    await user.click(gatilho);
    expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    const drawer = screen.getByRole('dialog', { name: 'Menu do mentor' });
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));
    const links = within(drawer).getAllByRole('link');
    const fechar = within(drawer).getByRole('button', { name: 'Fechar menu' });
    fechar.focus();
    await user.tab();
    expect(links[0]).toHaveFocus();
    await user.tab({ shift: true });
    expect(fechar).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(gatilho).toHaveFocus();
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha ao clicar no scrim', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    mostrarLayoutMobile();
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const overlay = container.querySelector('.mentor-sidebar-scrim')!;
    expect(overlay).not.toBeNull();
    await user.click(overlay);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveFocus();
  });

  it('navega pelo drawer e o fecha sem duplicar o host', async () => {
    const user = userEvent.setup();
    renderRotas();
    await screen.findByRole('heading', { name: 'Início' });
    mostrarLayoutMobile();
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Sessões' }));
    expect(await screen.findByRole('heading', { name: 'Sessões' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByTestId('drawer-aluno-host')).toHaveLength(1);
  });
});

describe('Guard e rotas', () => {
  it('reserva a estrutura do shell com skeleton enquanto a identidade carrega', () => {
    mockMe(undefined, { isPending: true, isLoading: true });
    renderRotas();
    expect(screen.getByRole('status', { name: 'Carregando o portal do mentor' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('heading', { name: 'Início' })).not.toBeInTheDocument();
  });

  it('erro inicial de identidade usa EstadoErro e permite tentar novamente', () => {
    mockMe(undefined, { isError: true });
    renderRotas();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o portal do mentor.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetchMe).toHaveBeenCalledOnce();
  });

  it('toggle desligado redireciona para / mesmo com dado em cache e erro de refetch', async () => {
    mockMe({ ...me(), portalMentor: false }, { isError: true });
    renderRotas();
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByTestId('localizacao')).toHaveTextContent(/^\/$/);
  });

  it.each([
    ['b2c', '/mentor/visao-geral'], ['b2c', '/mentor/canais'],
    ['b2b', '/mentor/turma'], ['b2b', '/mentor/mural'],
  ] as const)('%s não acessa %s', async (modalidade, path) => {
    mockMe(me(modalidade));
    renderRotas(path);
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
    expect(screen.getByTestId('localizacao')).toHaveTextContent('/mentor');
  });

  it.each([
    ['b2c', '/mentor', 'Início'], ['b2c', '/mentor/turma', 'Minha Turma'],
    ['b2b', '/mentor/visao-geral', 'Visão Geral'], ['b2c', '/mentor/detalhamento', 'Detalhamento por Simulados'],
    ['b2c', '/mentor/mural', 'Mural'], ['b2b', '/mentor/sessoes', 'Sessões'],
    ['b2b', '/mentor/canais', 'Canais'], ['b2c', '/mentor/intervencoes', 'Intervenções'],
  ] as const)('renderiza placeholder %s %s', async (modalidade, path, titulo) => {
    mockMe(me(modalidade));
    renderRotas(path);
    expect(await screen.findByRole('heading', { name: titulo })).toHaveAttribute('data-testid');
    expect(screen.getByTestId('experience-guard')).toHaveAttribute('data-experience', 'mentor');
  });

  it.each(['/mentor/mural', '/mentor/sessoes', '/mentor/intervencoes'])('erro global preserva %s', async (path) => {
    mockMe(me(), { isError: true });
    renderRotas(path);
    expect(await screen.findByRole('heading')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os dados da turma.');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetchMe).toHaveBeenCalledOnce();
  });

  it('B2B usa mensagem literal de indicadores e rota desconhecida volta ao início', async () => {
    mockMe(me('b2b'), { isError: true });
    renderRotas('/mentor/nao-existe');
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os indicadores.');
    expect(screen.getByTestId('localizacao')).toHaveTextContent(/^\/mentor$/);
  });
});
