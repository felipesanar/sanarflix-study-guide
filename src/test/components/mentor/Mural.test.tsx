import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const upload = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { storage: { from: (bucket: string) => ({ upload: (...a: unknown[]) => upload(bucket, ...a) }) } },
}));

const salvarPost = vi.fn();
const listarPosts = vi.fn();
const listarTags = vi.fn();
vi.mock('@/services/mentor/mural', () => ({
  salvarPost: (i: unknown) => salvarPost(i),
  listarPosts: (f: unknown) => listarPosts(f),
  listarTags: () => listarTags(),
}));

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const fetchTurma = vi.fn();
vi.mock('@/services/mentor/turma', () => ({ fetchTurma: () => fetchTurma() }));

vi.mock('@/services/mentor/contexto', () => ({
  fetchMentorContexto: () =>
    Promise.resolve({ mentor: { user_id: 'mentor-1', nome: 'Ana', tipo: 'b2c' }, alunos_ativos: 3 }),
}));

import Mural from '@/features/mentor/routes/Mural';
import { nomeSeguro } from '@/features/mentor/components/mural/muralUtils';

const aluno = (over: Record<string, unknown>) => ({
  email: 'x@a.com',
  nome: 'X',
  telefone: null,
  semestre: 1,
  acesso_ate: null,
  b2b: true,
  academy_user_id: null,
  sanarflix_user_id: null,
  ultima_atividade: null,
  dias_sem_atividade: 0,
  segmento: 'ativo',
  ...over,
});

const TURMA = [
  aluno({ email: 'bia@a.com', nome: 'Bia', semestre: 3, segmento: 'sumido' }),
  aluno({ email: 'caio@a.com', nome: 'Caio', semestre: 10, segmento: 'esfriando' }),
  aluno({ email: 'dani@a.com', nome: 'Dani', semestre: 5, segmento: 'ativo' }),
];

const T = { timeout: 3000 };

function renderMural(url = '/mentor/mural') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Mural />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function preencherBasico(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Tag'), 'Aviso');
  await user.type(screen.getByLabelText('Título'), 'Simulado sábado');
  await user.type(screen.getByLabelText('Mensagem'), 'Não esqueçam.');
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchTurma.mockResolvedValue(TURMA);
  listarTags.mockResolvedValue(['Desempenho', 'Minha tag']);
  listarPosts.mockResolvedValue([]);
  salvarPost.mockResolvedValue({ post_id: 'p1', publicado: true, intervencao_id: 'i1' });
  upload.mockResolvedValue({ data: { path: 'ok' }, error: null });
});

describe('Mural — nova publicação', () => {
  it('publicar para a turma chama salvarPost com publicar e registrar intervenção por padrão', async () => {
    const user = userEvent.setup();
    renderMural();
    await preencherBasico(user);

    const publicar = await screen.findByRole('button', { name: 'Publicar para 3 alunos' });
    expect(screen.getByRole('checkbox', { name: /Registrar como intervenção \(Mensagem · 3 alunos\)/ })).toBeChecked();
    await user.click(publicar);

    await waitFor(() => expect(salvarPost).toHaveBeenCalledTimes(1), T);
    expect(salvarPost).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: 'Aviso',
        titulo: 'Simulado sábado',
        publico: 'turma',
        publicar: true,
        registrarIntervencao: true,
      }),
    );
  });

  it('salvar rascunho chama salvarPost com publicar false', async () => {
    const user = userEvent.setup();
    renderMural();
    await preencherBasico(user);
    await user.click(await screen.findByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(salvarPost).toHaveBeenCalled(), T);
    expect(salvarPost).toHaveBeenCalledWith(expect.objectContaining({ publicar: false, registrarIntervencao: false }));
  });

  it('link sem título bloqueia a publicação', async () => {
    const user = userEvent.setup();
    renderMural();
    await preencherBasico(user);
    await user.type(screen.getByLabelText('Link (opcional)'), 'https://exemplo.com');
    expect(screen.getByRole('button', { name: /Publicar para/ })).toBeDisabled();
    expect(screen.getByText('Dê um título ao link.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Título do link'), 'Material');
    expect(screen.getByRole('button', { name: /Publicar para/ })).toBeEnabled();
  });

  it('Selecionados sem nenhum aluno bloqueia a publicação', async () => {
    const user = userEvent.setup();
    renderMural();
    await preencherBasico(user);
    await user.click(screen.getByRole('radio', { name: 'Selecionados' }));
    expect(screen.getByRole('button', { name: 'Publicar para 0 alunos' })).toBeDisabled();
    expect(screen.getByText('Selecione ao menos um aluno.')).toBeInTheDocument();
  });

  it('atalho por segmento, busca e chip removível alimentam os destinatários', async () => {
    const user = userEvent.setup();
    renderMural();
    await preencherBasico(user);
    await user.click(screen.getByRole('radio', { name: 'Selecionados' }));

    await user.click(screen.getByRole('button', { name: 'Sumidos (1)' }));
    await user.type(screen.getByLabelText('Buscar aluno'), 'dani');
    await user.click(await screen.findByRole('button', { name: /Dani/ }));
    expect(screen.getByRole('button', { name: 'Publicar para 2 alunos' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Remover Bia' }));
    await user.click(screen.getByRole('button', { name: 'Publicar para 1 aluno' }));
    await waitFor(() => expect(salvarPost).toHaveBeenCalled(), T);
    expect(salvarPost).toHaveBeenCalledWith(
      expect.objectContaining({ publico: 'selecionados', destinatarios: ['dani@a.com'], publicar: true }),
    );
  });

  it('atalho de 9º a 12º seleciona o semestre separado', async () => {
    const user = userEvent.setup();
    renderMural();
    await screen.findByLabelText('Tag');
    await user.click(screen.getByRole('radio', { name: 'Selecionados' }));
    await user.click(screen.getByRole('button', { name: '10º semestre (1)' }));
    expect(screen.getByRole('button', { name: 'Remover Caio' })).toBeInTheDocument();
  });

  it('?para=<email> pré-seleciona o aluno em Selecionados', async () => {
    renderMural('/mentor/mural?para=bia@a.com');
    expect(await screen.findByRole('button', { name: 'Remover Bia' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Selecionados' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Publicar para 1 aluno' })).toBeInTheDocument();
  });

  it('?para=a,b pré-seleciona vários alunos (normaliza, remove duplicados e e-mails inválidos)', async () => {
    renderMural('/mentor/mural?para=bia@a.com,%20CAIO@a.com,bia@a.com,,nao-e-email');
    expect(await screen.findByRole('button', { name: 'Remover Bia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Caio' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Selecionados' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Publicar para 2 alunos' })).toBeInTheDocument();
  });

  it('publicar com ?para=a,b envia os dois destinatários', async () => {
    const user = userEvent.setup();
    renderMural('/mentor/mural?para=bia%40a.com%2Ccaio%40a.com');
    await preencherBasico(user);
    await user.click(await screen.findByRole('button', { name: 'Publicar para 2 alunos' }));
    await waitFor(() =>
      expect(salvarPost).toHaveBeenCalledWith(
        expect.objectContaining({ publico: 'selecionados', destinatarios: ['bia@a.com', 'caio@a.com'], publicar: true }),
      ),
    );
  });

  it('aba "Pra você" do preview só aparece em Selecionados', async () => {
    const user = userEvent.setup();
    renderMural();
    await screen.findByLabelText('Tag');
    expect(screen.getByRole('tab', { name: 'Coletivo' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Pra você' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Selecionados' }));
    expect(screen.getByRole('tab', { name: 'Pra você' })).toBeInTheDocument();
  });

  it('Enter no campo de busca ou no título não publica nada', async () => {
    const user = userEvent.setup();
    renderMural();
    await preencherBasico(user);
    await user.click(screen.getByRole('radio', { name: 'Selecionados' }));
    await user.click(screen.getByRole('button', { name: 'Sumidos (1)' }));
    await user.type(screen.getByLabelText('Buscar aluno'), 'dani{Enter}');
    await user.type(screen.getByLabelText('Título'), '{Enter}');
    await user.type(screen.getByLabelText('Tag'), '{Enter}');
    expect(salvarPost).not.toHaveBeenCalled();
  });

  it('link sem https:// bloqueia a publicação', async () => {
    const user = userEvent.setup();
    renderMural();
    await preencherBasico(user);
    await user.type(screen.getByLabelText('Link (opcional)'), 'http://exemplo.com');
    await user.type(screen.getByLabelText('Título do link'), 'Material');
    expect(screen.getByText('Use um link https://')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicar para/ })).toBeDisabled();
  });

  it('erro da RPC aparece no toast com a mensagem', async () => {
    const user = userEvent.setup();
    salvarPost.mockRejectedValue(new Error('link inválido (use https)'));
    renderMural();
    await preencherBasico(user);
    await user.click(await screen.findByRole('button', { name: /Publicar para/ }));
    await waitFor(
      () =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'link inválido (use https)', variant: 'destructive' }),
        ),
      T,
    );
  });

  it('falha no upload mostra erro e não chama salvarPost', async () => {
    const user = userEvent.setup();
    upload.mockResolvedValue({ data: null, error: { message: 'bucket indisponível' } });
    renderMural();
    await preencherBasico(user);
    await user.upload(screen.getByLabelText(/Anexo/), new File(['abc'], 'a.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Publicar para/ })).toBeEnabled(), T);
    await user.click(screen.getByRole('button', { name: /Publicar para/ }));
    await waitFor(
      () => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'bucket indisponível' })),
      T,
    );
    expect(salvarPost).not.toHaveBeenCalled();
  });

  it('anexo acima de 10 MB é recusado com mensagem clara e não envia', async () => {
    const user = userEvent.setup();
    renderMural();
    const grande = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(grande, 'size', { value: 11 * 1024 * 1024 });
    await user.upload(await screen.findByLabelText(/Anexo/), grande);
    expect(screen.getByRole('alert')).toHaveTextContent('10 MB');
    expect(upload).not.toHaveBeenCalled();
  });

  it('o campo de anexo só aceita imagem (PNG, JPG, WebP) e PDF', async () => {
    renderMural();
    const campo = await screen.findByLabelText(/Anexo/);
    expect(campo).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp,application/pdf');
  });

  it('anexo de tipo não permitido é recusado com mensagem clara e não envia', async () => {
    renderMural();
    const campo = await screen.findByLabelText(/Anexo/);
    const planilha = new File(['x'], 'notas.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(campo, { target: { files: [planilha] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Envie imagem (PNG, JPG, WebP) ou PDF');
    expect(screen.queryByText('notas.xlsx')).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it('anexo de tipo permitido com type vazio (extensão .png) passa e vai com o content-type certo', async () => {
    const user = userEvent.setup();
    renderMural();
    await preencherBasico(user);
    fireEvent.change(screen.getByLabelText(/Anexo/), { target: { files: [new File(['x'], 'foto.PNG', { type: '' })] } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Publicar para/ })).toBeEnabled(), T);
    await user.click(screen.getByRole('button', { name: /Publicar para/ }));
    await waitFor(() => expect(upload).toHaveBeenCalled(), T);
    expect(upload.mock.calls[0][3]).toEqual({ contentType: 'image/png' });
  });

  it('anexo é enviado ao bucket mural-anexos em {mentor}/{uuid}-{nome} e gravado no post', async () => {
    const user = userEvent.setup();
    renderMural();
    await preencherBasico(user);
    await user.upload(
      screen.getByLabelText(/Anexo/),
      new File(['abc'], 'Plano de estudos.pdf', { type: 'application/pdf' }),
    );
    // aguarda o contexto do mentor (user_id) chegar
    await waitFor(() => expect(screen.getByRole('button', { name: /Publicar para/ })).toBeEnabled(), T);
    await user.click(screen.getByRole('button', { name: /Publicar para/ }));

    await waitFor(() => expect(salvarPost).toHaveBeenCalled(), T);
    const [bucket, path] = upload.mock.calls[0];
    expect(bucket).toBe('mural-anexos');
    expect(path).toMatch(/^mentor-1\/[0-9a-f-]{36}-Plano_de_estudos\.pdf$/);
    expect(salvarPost).toHaveBeenCalledWith(
      expect.objectContaining({ anexoPath: path, anexoNome: 'Plano de estudos.pdf' }),
    );
  });
});

describe('Mural — publicadas', () => {
  const POST = {
    id: 'p9',
    tag: 'Desempenho',
    titulo: 'Seu resultado',
    mensagem: 'Bom trabalho',
    link_titulo: null,
    link_url: null,
    anexo_nome: null,
    anexo_path: null,
    publico: 'selecionados',
    status: 'publicado',
    publicado_em: '2026-10-10T12:00:00Z',
    origem: 'mentor',
    destinatarios: ['bia@a.com'],
  };

  it('mostra estado vazio sem publicações', async () => {
    renderMural();
    expect(await screen.findByText(/Você ainda não publicou nada/)).toBeInTheDocument();
  });

  it('mostra erro ao falhar o carregamento da lista', async () => {
    listarPosts.mockRejectedValue(new Error('boom'));
    renderMural();
    expect(await screen.findByText(/Não foi possível carregar as publicações/)).toBeInTheDocument();
  });

  it('filtra por aluno e por tag', async () => {
    const user = userEvent.setup();
    listarPosts.mockResolvedValue([POST]);
    renderMural();
    expect(await screen.findByText('Seu resultado')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filtrar por aluno'), 'bia@a.com');
    await waitFor(() => expect(listarPosts).toHaveBeenLastCalledWith({ alunoEmail: 'bia@a.com', tag: null }), T);
    await user.selectOptions(screen.getByLabelText('Filtrar por tag'), 'Minha tag');
    await waitFor(
      () => expect(listarPosts).toHaveBeenLastCalledWith({ alunoEmail: 'bia@a.com', tag: 'Minha tag' }),
      T,
    );
  });

  it('Editar reabre o formulário com o conteúdo do post', async () => {
    const user = userEvent.setup();
    listarPosts.mockResolvedValue([POST]);
    renderMural();
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(await screen.findByRole('heading', { name: 'Editar publicação' })).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveValue('Seu resultado');
    expect(screen.getByRole('button', { name: 'Remover Bia' })).toBeInTheDocument();
    // post já publicado: não duplica intervenção por padrão
    expect(screen.getByRole('checkbox', { name: /Registrar como intervenção/ })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Publicar para 1 aluno' }));
    await waitFor(() => expect(salvarPost).toHaveBeenCalled(), T);
    expect(salvarPost).toHaveBeenCalledWith(expect.objectContaining({ id: 'p9', publicar: true }));
  });
});

describe('nomeSeguro', () => {
  it('limita a 100 caracteres preservando a extensão', () => {
    const r = nomeSeguro(`${'a'.repeat(300)}.pdf`);
    expect(r).toHaveLength(100);
    expect(r.endsWith('.pdf')).toBe(true);
  });
});
