import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { QuestaoCompleta, QuestaoDetalhe } from '@/services/mentor/desempenho';

const fetchQuestao = vi.fn();
vi.mock('@/services/mentor/desempenho', async () => ({
  ...(await vi.importActual<typeof import('@/services/mentor/desempenho')>('@/services/mentor/desempenho')),
  fetchQuestao: (id: string, s: string[]) => fetchQuestao(id, s),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import { PainelQuestao } from '@/features/mentor/components/detalhamento/PainelQuestao';
import { ListaQuestoes } from '@/features/mentor/components/detalhamento/ListaQuestoes';
import { previaEmUmaLinha, textoSeguro, tituloDeParam } from '@/features/mentor/lib/textoSeguro';

const T = { timeout: 3000 };

const RESUMO: QuestaoDetalhe = {
  questao_id: 'q7',
  numero: 7,
  sequence_number: 2,
  grande_area: 'Clínica Médica',
  tema: 'Diabetes',
  correta_label: 'A',
  acerto_pct: 30,
  respostas: 10,
  distribuicao: { A: 3, B: 1, C: 5, D: 1 },
  emails: { B: ['b@x.com'], C: ['a@x.com', 'c@x.com'], D: ['x@x.com'] },
};

function completa(over: Partial<QuestaoCompleta> = {}): QuestaoCompleta {
  return {
    questao_id: 'q7',
    simulado_id: 's2',
    sequence_number: 2,
    numero: 7,
    grande_area: 'Clínica Médica',
    especialidade: 'Endocrinologia',
    tema: 'Diabetes',
    dificuldade: 'Difícil',
    enunciado: 'Paciente de 45 anos.\nGlicemia de jejum 180.\n\nQual a conduta?',
    imagens: [],
    explicacao: 'A metformina é a primeira escolha.',
    explicacao_imagem_url: null,
    respostas: 10,
    acerto_pct: 30,
    alternativas: [
      { label: 'A', texto: 'Metformina', correta: true, n: 3, pct: 30, emails: null },
      { label: 'B', texto: 'Insulina', correta: false, n: 1, pct: 10, emails: ['b@x.com'] },
      { label: 'C', texto: 'C) Sulfonilureia', correta: false, n: 5, pct: 50, emails: ['a@x.com', 'c@x.com'] },
      { label: 'D', texto: 'Dieta', correta: false, n: 1, pct: 10, emails: null },
    ],
    branco: { n: 0, emails: [] },
    ...over,
  };
}

const NOMES = { 'a@x.com': 'Ana Souza', 'c@x.com': 'Carla Dias' };

function renderPainel(questao: QuestaoDetalhe | null = RESUMO, simulados = ['s2']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (q: QuestaoDetalhe | null) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PainelQuestao questao={q} simulados={simulados} nomes={NOMES} onFechar={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const utils = render(ui(questao));
  return { ...utils, reabrir: (q: QuestaoDetalhe | null) => utils.rerender(ui(q)) };
}

describe('PainelQuestao: busca lazy e resumo como placeholder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchQuestao.mockResolvedValue(completa());
  });

  it('não busca nada com o painel fechado; ao abrir busca a questão com o recorte', async () => {
    const { reabrir } = renderPainel(null);
    expect(fetchQuestao).not.toHaveBeenCalled();
    reabrir(RESUMO);
    await waitFor(() => expect(fetchQuestao).toHaveBeenCalledTimes(1));
    expect(fetchQuestao).toHaveBeenCalledWith('q7', ['s2']);
  });

  it('mostra o resumo do detalhamento na hora, com o enunciado carregando', async () => {
    let resolver: (q: QuestaoCompleta) => void = () => {};
    fetchQuestao.mockReturnValue(new Promise<QuestaoCompleta>((r) => (resolver = r)));
    renderPainel();
    const painel = await screen.findByRole('dialog');
    expect(within(painel).getByTestId('enunciado-carregando')).toBeInTheDocument();
    expect(within(painel).getByTestId('alternativa-C')).toHaveTextContent(/Distrator dominante/);
    expect(within(painel).getByText('Ana Souza')).toBeInTheDocument();

    resolver(completa());
    expect(await within(painel).findByText(/Glicemia de jejum 180/, undefined, T)).toBeInTheDocument();
    expect(within(painel).queryByTestId('enunciado-carregando')).toBeNull();
  });

  it('mostra o enunciado como texto, preservando as quebras de linha, e o texto das alternativas', async () => {
    renderPainel();
    const painel = await screen.findByRole('dialog');
    const p = await within(painel).findByText(/Glicemia de jejum 180/, undefined, T);
    expect(p.tagName).toBe('P');
    expect(p.className).toMatch(/whitespace-pre-line/);
    expect(p.textContent).toBe('Paciente de 45 anos.\nGlicemia de jejum 180.\n\nQual a conduta?');
    expect(within(painel).getByTestId('alternativa-A')).toHaveTextContent('Metformina');
    expect(within(painel).getByTestId('alternativa-C')).toHaveTextContent('Sulfonilureia');
    // O texto vem com o rótulo na frente ("C) Sulfonilureia"): o rótulo aparece uma vez só, no badge.
    expect(within(painel).getByTestId('alternativa-C').textContent).not.toMatch(/C\)/);
    expect(within(painel).getAllByText(/Sulfonilureia/)).toHaveLength(1);
    expect(painel.textContent).toMatch(/Endocrinologia/);
    expect(painel.textContent).toMatch(/Difícil/);
  });

  it('conteúdo com <script> nunca vira HTML: tags somem, nada executa, o texto fica', async () => {
    (window as unknown as { __xss?: number }).__xss = undefined;
    fetchQuestao.mockResolvedValue(
      completa({
        enunciado: 'Antes <script>window.__xss = 1</script><img src=x onerror="window.__xss = 2"><b>negrito</b> depois',
        alternativas: [
          { label: 'A', texto: '<iframe src="https://evil.test"></iframe>Certa', correta: true, n: 3, pct: 100, emails: null },
        ],
      }),
    );
    renderPainel();
    const painel = await screen.findByRole('dialog');
    await within(painel).findByText(/negrito depois/, undefined, T);
    expect(painel.querySelector('script')).toBeNull();
    expect(painel.querySelector('iframe')).toBeNull();
    expect(painel.querySelector('b')).toBeNull();
    expect(painel.querySelectorAll('img')).toHaveLength(0);
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
    expect(painel.textContent).not.toMatch(/<script|<b>|<iframe/);
    expect(within(painel).getByTestId('alternativa-A')).toHaveTextContent('Certa');
  });

  it('entidade escapada aparece como texto literal (nunca é interpretada)', async () => {
    fetchQuestao.mockResolvedValue(completa({ enunciado: 'Use &lt;script&gt;alert(1)&lt;/script&gt; no texto' }));
    renderPainel();
    const painel = await screen.findByRole('dialog');
    await within(painel).findByText(/Use <script>alert\(1\)<\/script> no texto/, undefined, T);
    expect(painel.querySelector('script')).toBeNull();
  });

  it('só renderiza <img> para URL https (lazy, alt "Imagem da questão N")', async () => {
    fetchQuestao.mockResolvedValue(
      completa({
        imagens: [
          'https://cdn.exemplo.com/q7-a.png',
          'http://cdn.exemplo.com/q7-b.png',
          'javascript:alert(1)',
          'data:image/png;base64,AAAA',
          '//cdn.exemplo.com/q7-c.png',
        ],
      }),
    );
    renderPainel();
    const painel = await screen.findByRole('dialog');
    const img = await within(painel).findByAltText('Imagem da questão 7', undefined, T);
    expect(within(painel).getAllByAltText('Imagem da questão 7')).toHaveLength(1);
    expect(img).toHaveAttribute('src', 'https://cdn.exemplo.com/q7-a.png');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('avisa quando a questão tem imagem mas nenhuma URL passa na guarda', async () => {
    fetchQuestao.mockResolvedValue(completa({ imagens: ['http://inseguro.test/a.png'] }));
    renderPainel({ ...RESUMO, tem_imagem: true });
    const painel = await screen.findByRole('dialog');
    expect(await within(painel).findByText(/não pôde ser exibido com segurança/, undefined, T)).toBeInTheDocument();
    expect(painel.querySelectorAll('img')).toHaveLength(0);
  });

  it('sinaliza o distrator dominante (errada mais marcada) e o gabarito, com n e %', async () => {
    renderPainel();
    const painel = await screen.findByRole('dialog');
    await within(painel).findByText(/Glicemia/, undefined, T);
    expect(within(painel).getByTestId('alternativa-C')).toHaveTextContent(/Distrator dominante/);
    expect(within(painel).getByTestId('alternativa-C')).toHaveTextContent('5 · 50%');
    expect(within(painel).getByTestId('alternativa-B')).not.toHaveTextContent(/Distrator dominante/);
    expect(within(painel).getByTestId('alternativa-A')).toHaveTextContent(/Gabarito/);
    expect(within(painel).getByTestId('alternativa-A')).not.toHaveTextContent(/Distrator dominante/);
  });

  it('sem nenhuma marcação errada não há distrator dominante', async () => {
    fetchQuestao.mockResolvedValue(
      completa({
        alternativas: [
          { label: 'A', texto: 'x', correta: true, n: 4, pct: 100, emails: null },
          { label: 'B', texto: 'y', correta: false, n: 0, pct: 0, emails: [] },
        ],
      }),
    );
    renderPainel();
    const painel = await screen.findByRole('dialog');
    await within(painel).findByText(/Glicemia/, undefined, T);
    expect(within(painel).queryByText(/Distrator dominante/)).toBeNull();
  });

  it('"Quem marcou" usa os e-mails da questão (com fallback ao resumo) e mantém as ações', async () => {
    renderPainel();
    const painel = await screen.findByRole('dialog');
    await within(painel).findByText(/Glicemia/, undefined, T);
    // D veio com emails null na RPC nova: cai no resumo do detalhamento.
    expect(within(painel).getByRole('heading', { name: /Quem marcou D/ })).toBeInTheDocument();
    expect(within(painel).getByText('x@x.com')).toBeInTheDocument();

    fireEvent.click(within(painel).getByRole('button', { name: 'Mensagem pra quem marcou C' }));
    const mural = new URL(navigate.mock.calls[0][0] as string, 'http://x');
    expect(mural.pathname).toBe('/mentor/mural');
    expect(mural.searchParams.get('para')).toBe('a@x.com,c@x.com');

    fireEvent.click(within(painel).getByRole('button', { name: 'Criar intervenção — quem marcou C' }));
    const interv = new URL(navigate.mock.calls[1][0] as string, 'http://x');
    expect(interv.pathname).toBe('/mentor/intervencoes');
    expect(interv.searchParams.get('novo')).toBe('1');
    expect(interv.searchParams.get('alunos')).toBe('a@x.com,c@x.com');
  });

  it('a explicação vem recolhida, abre e fecha pelo botão, e a imagem dela também passa pela guarda https', async () => {
    fetchQuestao.mockResolvedValue(completa({ explicacao_imagem_url: 'https://cdn.exemplo.com/expl.png' }));
    renderPainel();
    const painel = await screen.findByRole('dialog');
    const botao = await within(painel).findByRole('button', { name: 'Explicação' }, T);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(within(painel).queryByText(/metformina é a primeira escolha/)).toBeNull();

    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(within(painel).getByText(/metformina é a primeira escolha/)).toBeInTheDocument();
    expect(within(painel).getByAltText(/Imagem da explicação/)).toHaveAttribute('src', 'https://cdn.exemplo.com/expl.png');

    fireEvent.click(botao);
    expect(within(painel).queryByText(/metformina é a primeira escolha/)).toBeNull();
  });

  it('explicação com imagem insegura mostra só o texto', async () => {
    fetchQuestao.mockResolvedValue(completa({ explicacao_imagem_url: 'javascript:alert(1)' }));
    renderPainel();
    const painel = await screen.findByRole('dialog');
    fireEvent.click(await within(painel).findByRole('button', { name: 'Explicação' }, T));
    expect(within(painel).getByText(/metformina é a primeira escolha/)).toBeInTheDocument();
    expect(painel.querySelectorAll('img')).toHaveLength(0);
  });

  it('sem explicação não mostra o bloco', async () => {
    fetchQuestao.mockResolvedValue(completa({ explicacao: null, explicacao_imagem_url: null }));
    renderPainel();
    const painel = await screen.findByRole('dialog');
    await within(painel).findByText(/Glicemia/, undefined, T);
    expect(within(painel).queryByRole('button', { name: 'Explicação' })).toBeNull();
  });

  it('resultado não liberado: explica e mantém o resumo', async () => {
    fetchQuestao.mockRejectedValue(new Error('resultado deste simulado ainda não foi liberado'));
    renderPainel();
    const painel = await screen.findByRole('dialog');
    expect(await within(painel).findByText(/ainda não foi liberado aos alunos/, undefined, T)).toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    expect(within(painel).getByTestId('alternativa-C')).toBeInTheDocument();
  });

  it('falha qualquer: erro com "Tentar de novo" e o resumo segue na tela', async () => {
    fetchQuestao.mockRejectedValueOnce(new Error('boom'));
    renderPainel();
    const painel = await screen.findByRole('dialog');
    expect(await within(painel).findByText(/Não foi possível carregar o enunciado/, undefined, T)).toBeInTheDocument();
    expect(within(painel).getByTestId('alternativa-A')).toBeInTheDocument();
    fetchQuestao.mockResolvedValue(completa());
    fireEvent.click(within(painel).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(painel).findByText(/Glicemia/, undefined, T)).toBeInTheDocument();
  });

  it('backend antigo (sem campos novos no resumo): funciona só com o detalhamento + a RPC nova ausente', async () => {
    fetchQuestao.mockRejectedValue(new Error('function mentor_questao does not exist'));
    renderPainel();
    const painel = await screen.findByRole('dialog');
    expect(await within(painel).findByText(/Não foi possível carregar o enunciado/, undefined, T)).toBeInTheDocument();
    expect(within(painel).getByRole('button', { name: 'Mensagem pra quem marcou C' })).toBeInTheDocument();
  });
});

describe('ListaQuestoes: prévia do enunciado', () => {
  it('mostra o início do enunciado em uma linha, sem marcação', () => {
    render(
      <ListaQuestoes
        multiSimulado={false}
        onAbrir={() => {}}
        questoes={[
          { ...RESUMO, enunciado_inicio: 'Paciente <b>de 45 anos</b>\ncom glicemia alta', especialidade: 'Endocrinologia', tem_imagem: true },
          { ...RESUMO, questao_id: 'q8', numero: 8 },
        ]}
      />,
    );
    const previas = screen.getAllByTestId('previa-enunciado');
    expect(previas).toHaveLength(1);
    expect(previas[0]).toHaveTextContent('Paciente de 45 anos com glicemia alta');
    expect(previas[0].innerHTML).not.toMatch(/<b>/);
    expect(screen.getByText('Clínica Médica · Endocrinologia')).toBeInTheDocument();
  });
});

describe('tema curto ("Especialidade > Tema")', () => {
  const comPrefixo: QuestaoDetalhe = {
    ...RESUMO,
    tema: 'Neonatologia > Sepse neonatal',
    tema_curto: 'Sepse neonatal',
    especialidade: 'Neonatologia',
  };

  it('a lista mostra o tema curto e a especialidade como rótulo; sem tema_curto mostra o tema inteiro', () => {
    render(
      <ListaQuestoes
        multiSimulado={false}
        onAbrir={() => {}}
        questoes={[comPrefixo, { ...RESUMO, questao_id: 'q9', numero: 9, tema: 'Tema antigo > X' }]}
      />,
    );
    expect(screen.getByText('Sepse neonatal')).toBeInTheDocument();
    expect(screen.queryByText('Neonatologia > Sepse neonatal')).toBeNull();
    expect(screen.getByText('Clínica Médica · Neonatologia')).toBeInTheDocument();
    expect(screen.getByText('Tema antigo > X')).toBeInTheDocument();
  });

  it('o painel prefere o tema curto (da RPC nova ou do resumo)', async () => {
    fetchQuestao.mockResolvedValue(completa({ tema: 'Neonatologia > Sepse neonatal', tema_curto: 'Sepse neonatal', especialidade: 'Neonatologia' }));
    renderPainel(comPrefixo);
    const painel = await screen.findByRole('dialog');
    await within(painel).findByText(/Glicemia/, undefined, T);
    expect(painel.textContent).toMatch(/Neonatologia · Sepse neonatal/);
    expect(painel.textContent).not.toMatch(/Neonatologia > Sepse/);
  });
});

describe('textoSeguro / tituloDeParam', () => {
  it('tira tags e o conteúdo de script/style, converte <br>/<p> em quebra e decodifica entidades comuns', () => {
    expect(textoSeguro('a<br>b<p>c</p>d')).toBe('a\nb\nc\nd');
    expect(textoSeguro('x<script>alert(1)</script>y<style>p{}</style>z')).toBe('xyz');
    expect(textoSeguro('<<b>script>alert(1)</script>')).not.toMatch(/<script/i);
    expect(textoSeguro('5 &gt; 3 &amp; 2 &lt; 4&nbsp;ok')).toBe('5 > 3 & 2 < 4 ok');
    expect(textoSeguro(null)).toBe('');
    expect(textoSeguro(undefined)).toBe('');
  });

  it('prévia corta em uma linha', () => {
    expect(previaEmUmaLinha('a\n\nb   c', 50)).toBe('a b c');
    expect(previaEmUmaLinha('x'.repeat(200), 20)).toHaveLength(20);
  });

  it('título da URL: texto simples, sem marcação nem controle, até 120 caracteres', () => {
    expect(tituloDeParam('Tema: <b>Diabetes</b> (Clínica)')).toBe('Tema: Diabetes (Clínica)');
    expect(tituloDeParam('a\u0000b\nc')).toBe('a b c');
    expect(tituloDeParam('x'.repeat(300))).toHaveLength(120);
    expect(tituloDeParam('   ')).toBeNull();
    expect(tituloDeParam(null)).toBeNull();
  });
});
