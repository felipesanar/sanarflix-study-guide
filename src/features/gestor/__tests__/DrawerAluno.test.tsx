import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// `@/test/utils` e não o `render` cru: o rodapé do drawer é o `AcoesRecorte`,
// que lê o recorte da URL (`useFiltrosGestor` → `useSearchParams`) e portanto
// exige um Router montado. Mesmo wrapper de DrawerTemas.test.tsx.
import { render, screen, userEvent, waitFor, within } from '@/test/utils';
import { DrawerAluno } from '@/features/gestor/components/DrawerAluno';
import { useAluno, useAlunoContato, useGestorContexto } from '@/features/gestor/api/queries';
import { TRACO } from '@/features/gestor/lib/formatters';
import type { AlunoContato, AlunoSimuladoEntry, Meta } from '@/features/gestor/api/types';

// O `<Toaster />` não faz parte do wrapper de teste: sem interceptar o hook, o
// aviso de "exportação indisponível" não teria onde aparecer para ser afirmado.
const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

vi.mock('@/features/gestor/api/queries', () => ({
  useAluno: vi.fn(),
  useAlunoContato: vi.fn(),
  // O rodapé de ações é o `AcoesRecorte`, que lê `podeExportar` do contexto
  // resolvido no SERVIDOR — o mock do módulo precisa expor este hook também.
  useGestorContexto: vi.fn(),
}));

const mockUseAluno = vi.mocked(useAluno);
const mockUseAlunoContato = vi.mocked(useAlunoContato);
const mockUseContexto = vi.mocked(useGestorContexto);

const META: Meta = {
  periodo: '2026',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-08-04T10:00:00Z',
  criterio: 'aluno no recorte da IES',
  partial: false,
  lowSample: false,
};

/**
 * `get_gestor_aluno` devolve UMA ENTRADA POR SIMULADO — nunca um objeto
 * singular. Esta é a forma real de `useAluno(...).data` (ver api/types.ts,
 * `AlunoSimuladoEntry`, e o comentário do achado 19/card 106).
 */
const ENTRADA_S1: AlunoSimuladoEntry = {
  id: 'a1',
  nome: 'Ana Prado',
  semestre: 11,
  participou: true,
  acertos: 71,
  proficiencia: 71,
  situacao: 'proficiente',
  posicao: { lugar: 12, total: 118, percentil: 90 },
  acertoPorArea: [{ area: 'Clínica Médica', acertoPct: 42, critica: true }],
  variacao: 3,
  simuladoId: 's1',
  simuladoNome: 'Simulado 1',
  simuladoData: '2026-03-10T12:00:00Z',
};

const ENTRADA_S2: AlunoSimuladoEntry = {
  id: 'a1',
  nome: 'Ana Prado',
  semestre: 11,
  participou: true,
  acertos: 78,
  proficiencia: 78,
  situacao: 'proficiente',
  posicao: { lugar: 8, total: 120, percentil: 93 },
  acertoPorArea: [{ area: 'Clínica Médica', acertoPct: 55, critica: false }],
  variacao: 7,
  simuladoId: 's2',
  simuladoNome: 'Simulado 2',
  simuladoData: '2026-05-12T12:00:00Z',
};

const resultado = (over: Record<string, unknown> = {}) => ({
  data: undefined,
  meta: META,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  ...over,
});

function montar(props?: Partial<React.ComponentProps<typeof DrawerAluno>>) {
  const onFechar = vi.fn();
  const utils = render(
    <DrawerAluno alunoId="a1" nome="Ana Prado" simulados={['s1', 's2']} onFechar={onFechar} {...props} />,
  );
  return { ...utils, onFechar };
}

/** Telefone default para os testes que não são sobre telefone — número plausível, sem relevância própria. */
const CONTATO_PADRAO: AlunoContato = { id: 'a1', telefone: '11988887777' };

/**
 * Contexto do gestor com a capability de export JÁ RESOLVIDA pelo servidor
 * (`get_gestor_contexto`) — nenhuma role é lida no cliente. `iesDisponiveis`
 * é obrigatório: `AcoesRecorte` resolve o nome da IES do RECORTE contra essa
 * lista, porque `iesAtual` é a IES de cadastro e não acompanha o dropdown.
 */
const contextoComExport = (podeExportar: boolean) =>
  ({
    data: {
      iesAtual: { id: 'ies-1', nome: 'Universidade Teste' },
      iesDisponiveis: [{ id: 'ies-1', nome: 'Universidade Teste' }],
      podeExportar,
    },
    meta: META,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }) as unknown as ReturnType<typeof useGestorContexto>;

beforeEach(() => {
  mockUseAluno.mockReturnValue(resultado({ data: [ENTRADA_S1] }) as unknown as ReturnType<typeof useAluno>);
  mockUseAlunoContato.mockReturnValue(
    resultado({ data: CONTATO_PADRAO }) as unknown as ReturnType<typeof useAlunoContato>,
  );
  mockUseContexto.mockReturnValue(contextoComExport(true));
});

describe('DrawerAluno — fechado', () => {
  it('alunoId nulo não renderiza o dialog', () => {
    render(<DrawerAluno alunoId={null} nome="" simulados={[]} onFechar={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/**
 * Telefone do aluno (05/08). Ele shipou para produção em 31/07 pelo
 * `StudentAnalyticsDrawer` do console antigo — decisão do Felipe: qualquer
 * gestor pode ver, e o admin também. Com o console apagado, sumiria de
 * produção; foi trazido para cá.
 *
 * A busca é própria (`useAlunoContato`), independente da de simulados: a RPC
 * `get_gestor_aluno_contato` devolve UM aluno por chamada, deliberadamente —
 * somar telefone a uma RPC de turma despejaria o telefone de todos os alunos
 * a cada load.
 */
describe('DrawerAluno — telefone do aluno', () => {
  it('com telefone cadastrado, mostra o número', () => {
    montar();
    expect(screen.getByTestId('drawer-telefone')).toHaveTextContent('11988887777');
  });

  it('sem telefone cadastrado, mostra TRAÇO — nunca vazio, nunca texto inventado', () => {
    mockUseAlunoContato.mockReturnValue(
      resultado({ data: { id: 'a1', telefone: null } }) as unknown as ReturnType<typeof useAlunoContato>,
    );
    montar();
    const celula = screen.getByTestId('drawer-telefone');
    expect(celula).toHaveTextContent(TRACO);
    // Ausência não pode virar afirmação: nem dígito, nem "não informado".
    expect(celula.textContent ?? '').not.toMatch(/\d/);
    expect(celula.textContent ?? '').not.toMatch(/informad/i);
  });

  it('erro na busca do contato cai no mesmo TRAÇO e não derruba o resto do drawer', () => {
    mockUseAlunoContato.mockReturnValue(
      resultado({ data: undefined, isError: true }) as unknown as ReturnType<typeof useAlunoContato>,
    );
    montar();
    expect(screen.getByTestId('drawer-telefone')).toHaveTextContent(TRACO);
    // O drawer continua servindo o que ele sabe: a métrica do simulado.
    expect(screen.getByText('Proficiência')).toBeInTheDocument();
  });

  it('enquanto carrega, não mostra número nem finge ausência', () => {
    mockUseAlunoContato.mockReturnValue(
      resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useAlunoContato>,
    );
    montar();
    expect(screen.getByTestId('drawer-telefone').textContent ?? '').not.toMatch(/\d/);
  });
});

describe('DrawerAluno — carregando e erro', () => {
  it('loading: skeleton acessível, sem número ainda', () => {
    mockUseAluno.mockReturnValue(resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useAluno>);
    montar();
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Ana Prado/);
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.queryByText('Proficiência')).not.toBeInTheDocument();
  });

  it('erro: mensagem + Tentar novamente refaz só esta consulta', async () => {
    const refetch = vi.fn();
    mockUseAluno.mockReturnValue(
      resultado({ data: undefined, isError: true, refetch }) as unknown as ReturnType<typeof useAluno>,
    );
    const user = userEvent.setup();
    montar();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('DrawerAluno — visão detalhada de um simulado (§4.8)', () => {
  it('mostra Proficiência, posição e % de acerto por área — sem "Nota TRI"', () => {
    montar();
    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAccessibleName(/Ana Prado/);
    expect(dialogo).toHaveTextContent('Proficiência');
    expect(dialogo).toHaveTextContent('71');
    expect(dialogo).toHaveTextContent('12º de 118');
    expect(dialogo).toHaveTextContent('42%');
    expect(dialogo.textContent).not.toMatch(/Nota TRI/i);
  });

  it('marca a área crítica no bloco dedicado e também no rótulo da barra', () => {
    montar();

    const bloco = screen.getByTestId('drawer-area-critica-s1');
    expect(bloco).toHaveTextContent('Grande área crítica');
    expect(bloco).toHaveTextContent('Clínica Médica · 42% de acerto');
    // Cor nunca é canal único: a barra da área carrega a marca em texto.
    expect(screen.getByText(/\(área crítica\)/)).toBeInTheDocument();
  });

  /**
   * §4.5/§6: o comparativo por grande área é BARRA, não lista texto-a-texto —
   * o canal visual é o que permite varrer as áreas de um aluno de relance.
   */
  it('desenha uma barra por grande área, com o percentual como valor acessível', () => {
    montar();
    const barra = screen.getByRole('progressbar', { name: /Clínica Médica/ });
    expect(barra).toHaveAttribute('aria-valuenow', '42');
    expect(barra).toHaveAttribute('aria-valuemin', '0');
    expect(barra).toHaveAttribute('aria-valuemax', '100');
  });
});

/**
 * Cabeçalho do drawer (§4.5): avatar circular de iniciais, nome e uma linha de
 * contexto com o período e a cobertura do recorte ("3 de 3 simulados").
 */
describe('DrawerAluno — cabeçalho', () => {
  it('avatar de iniciais e linha de contexto com período e cobertura', () => {
    montar();
    const dialogo = screen.getByRole('dialog');

    // Iniciais = primeira letra do primeiro e do último nome.
    expect(within(dialogo).getByText('AP')).toBeInTheDocument();
    expect(dialogo).toHaveTextContent('11º período · 1 de 2 simulados');
  });

  it('sem semestre no contrato, o período vira TRAÇO — nunca 0º', () => {
    mockUseAluno.mockReturnValue(
      resultado({ data: [{ ...ENTRADA_S1, semestre: null }] }) as unknown as ReturnType<typeof useAluno>,
    );
    montar();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent(`${TRACO} período`);
    expect(dialogo).not.toHaveTextContent('0º período');
  });

  /**
   * A cobertura casava DUAS fontes com `WHERE` diferente: o numerador vinha de
   * `get_gestor_aluno` (que com `p_simulados` vazio devolve tudo o que o aluno
   * tem) e o denominador do recorte de `get_gestor_visao_geral` (que filtra).
   * Sem denominador não existe fração para mostrar — e "3 de 0" é pior que
   * nada, porque afirma um recorte que não foi pedido.
   */
  it('sem recorte de simulados, a cobertura é OMITIDA — nunca "N de 0"', () => {
    mockUseAluno.mockReturnValue(
      resultado({ data: [ENTRADA_S1, ENTRADA_S2] }) as unknown as ReturnType<typeof useAluno>,
    );
    montar({ simulados: [] });
    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveTextContent('11º período');
    expect(dialogo.textContent ?? '').not.toMatch(/de 0 simulados/);
    expect(dialogo.textContent ?? '').not.toMatch(/\d+ de \d+ simulados?/);
  });

  /** Numerador e denominador saem do MESMO conjunto: o recorte pedido. */
  it('conta só os simulados do recorte — o numerador nunca passa o denominador', () => {
    mockUseAluno.mockReturnValue(
      resultado({ data: [ENTRADA_S1, ENTRADA_S2] }) as unknown as ReturnType<typeof useAluno>,
    );
    montar({ simulados: ['s2'] });
    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveTextContent('11º período · 1 de 1 simulado');
    expect(dialogo.textContent ?? '').not.toMatch(/2 de 1/);
  });
});

/**
 * O botão de fechar do drawer (§4.5 + docs/11-acessibilidade). O `SheetContent`
 * expõe os slots justamente para o portal do gestor: sem passá-los, o leitor de
 * tela anuncia "Close" em inglês num portal todo em pt-BR, o glifo é o `X` do
 * Lucide (o handoff §3 exige 100% Fontello do Dendê) e o scrim fica no
 * `bg-black/80` do shadcn em vez do `--gp-scrim` do tema.
 */
describe('DrawerAluno — alvo de fechar', () => {
  it('anuncia "Fechar" em pt-BR e usa o glifo close do Dendê, nunca o X do Lucide', () => {
    montar();
    const fechar = screen.getByRole('button', { name: 'Fechar' });

    expect(fechar.querySelector('.icon-dende-icons-close-outlined')).not.toBeNull();
    expect(fechar.querySelector('svg')).toBeNull();
    expect(screen.queryByText('Close')).toBeNull();
  });

  it('é o alvo de 30×30 com borda e raio 8px do handoff', () => {
    montar();
    const fechar = screen.getByRole('button', { name: 'Fechar' });

    expect(fechar.className).toContain('h-[30px]');
    expect(fechar.className).toContain('w-[30px]');
    expect(fechar.className).toContain('rounded-[8px]');
    expect(fechar.className).toContain('border-[color:var(--gp-border-strong)]');
    // O `opacity-100` precisa VENCER o `opacity-70` do shadcn via tailwind-merge.
    expect(fechar.className).toContain('opacity-100');
    expect(fechar.className).not.toContain('opacity-70');
  });

  it('o scrim é o do tema do gestor, não o bg-black/80 do shadcn', () => {
    const { baseElement } = montar();

    expect(baseElement.querySelector('.bg-\\[var\\(--gp-scrim\\)\\]')).not.toBeNull();
    expect(baseElement.querySelector('.bg-black\\/80')).toBeNull();
  });
});

/**
 * Sparkline de evolução (docs/06 §6). Ela plota os MESMOS valores por simulado,
 * um ponto cada — não produz número novo e por isso não fere a regra de
 * agregação honesta. Só existe com 2+ pontos MEDIDOS.
 */
describe('DrawerAluno — sparkline de evolução', () => {
  it('com 2+ simulados medidos, desenha a série com nome e valor de cada ponto', () => {
    mockUseAluno.mockReturnValue(
      resultado({ data: [ENTRADA_S1, ENTRADA_S2] }) as unknown as ReturnType<typeof useAluno>,
    );
    montar();

    expect(screen.getByTestId('drawer-evolucao')).toBeInTheDocument();
    const grafico = screen.getByRole('img', { name: /Evolução de proficiência/ });
    expect(grafico).toHaveAccessibleName(/Simulado 1: 71/);
    expect(grafico).toHaveAccessibleName(/Simulado 2: 78/);
  });

  it('com um único ponto medido não há evolução para desenhar', () => {
    montar();
    expect(screen.queryByTestId('drawer-evolucao')).not.toBeInTheDocument();
  });

  it('simulado sem nota fica FORA da série — nunca vira zero nem interpolação', () => {
    mockUseAluno.mockReturnValue(
      resultado({
        data: [ENTRADA_S1, { ...ENTRADA_S2, proficiencia: null }],
      }) as unknown as ReturnType<typeof useAluno>,
    );
    montar();
    // Um só ponto medido sobra: o bloco inteiro não é renderizado.
    expect(screen.queryByTestId('drawer-evolucao')).not.toBeInTheDocument();
  });
});

/**
 * Rodapé de ações (§4.5 e §7.7): `Exportar` + `Copiar resumo` pelo MESMO
 * `AcoesRecorte` do DrawerTemas — o gate de `podeExportar` é ausência de
 * render, nunca controle desabilitado.
 */
describe('DrawerAluno — rodapé de ações', () => {
  it('com a capability, oferece Exportar e Copiar resumo', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Exportar recorte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar resumo' })).toBeInTheDocument();
  });

  it('sem a capability, as ações ficam AUSENTES — não desabilitadas', () => {
    mockUseContexto.mockReturnValue(contextoComExport(false));
    montar();
    expect(screen.queryByRole('button', { name: 'Exportar recorte' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar resumo' })).not.toBeInTheDocument();
  });

  it('sem `onExportar`, o clique avisa em vez de ser engolido em silêncio', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Exportar recorte' }));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/não está disponível/i) }),
    );
  });

  it('com `onExportar`, entrega o escopo do aluno', async () => {
    const user = userEvent.setup();
    const onExportar = vi.fn();
    montar({ onExportar });
    await user.click(screen.getByRole('button', { name: 'Exportar recorte' }));
    expect(onExportar).toHaveBeenCalledWith('aluno:a1');
  });

  /**
   * §7.7: "Copiar resumo" copia o recorte DESTE aluno agregado por simulado —
   * nunca uma lista nominal de terceiros.
   */
  it('Copiar resumo leva o agregado por simulado, e nenhum outro aluno', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    montar();

    await user.click(screen.getByRole('button', { name: 'Copiar resumo' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const texto = writeText.mock.calls[0][0] as string;
    expect(texto).toContain('Ana Prado — proficiência por simulado');
    expect(texto).toContain('Simulado 1');
    expect(texto).toContain('proficiência 71');
  });
});

describe('DrawerAluno — DOIS OU MAIS simulados: nunca funde nem tira média (§4.8, regra de agregação honesta)', () => {
  beforeEach(() => {
    mockUseAluno.mockReturnValue(
      resultado({ data: [ENTRADA_S1, ENTRADA_S2] }) as unknown as ReturnType<typeof useAluno>,
    );
  });

  it('renderiza uma seção por simulado, com o nome de cada um', () => {
    montar();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('Simulado 1');
    expect(dialogo).toHaveTextContent('Simulado 2');
  });

  it('mantém os dois valores de proficiência distintos — nenhuma média (71 e 78, nunca 74,5)', () => {
    montar();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('71');
    expect(dialogo).toHaveTextContent('78');
    expect(dialogo.textContent).not.toMatch(/74[.,]5/);
  });

  it('mantém as duas posições distintas', () => {
    montar();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('12º de 118');
    expect(dialogo).toHaveTextContent('8º de 120');
  });
});

describe('DrawerAluno — aguardando_resultado não é abaixo_do_limiar (achado 03/08)', () => {
  it('proficiência TRACO (nunca 0) e rótulo "Aguardando resultado"', () => {
    const entradaAguardando: AlunoSimuladoEntry = {
      ...ENTRADA_S1,
      participou: true,
      proficiencia: null,
      acertos: null,
      situacao: 'aguardando_resultado',
      posicao: undefined,
      variacao: undefined,
      acertoPorArea: undefined,
    };
    mockUseAluno.mockReturnValue(
      resultado({ data: [entradaAguardando] }) as unknown as ReturnType<typeof useAluno>,
    );
    montar();
    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveTextContent('Aguardando resultado');
    expect(dialogo).not.toHaveTextContent('Abaixo do limiar');
    expect(screen.getByTestId('drawer-proficiencia-s1')).toHaveTextContent('—');
    expect(screen.getByTestId('drawer-proficiencia-s1')).not.toHaveTextContent('0');
  });
});

describe('DrawerAluno — sem nenhum simulado no recorte pedido', () => {
  it('mostra estado vazio, não quebra', () => {
    mockUseAluno.mockReturnValue(resultado({ data: [] }) as unknown as ReturnType<typeof useAluno>);
    montar();
    expect(screen.getByRole('dialog')).toHaveTextContent(/nenhum simulado/i);
  });
});

describe('DrawerAluno — fechar', () => {
  it('onOpenChange(false) (ESC, clique fora, botão fechar) chama onFechar', async () => {
    const user = userEvent.setup();
    const { onFechar } = montar();

    await user.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});

afterEach(() => {
  vi.clearAllMocks();
  // O `navigator` stubado no teste de "Copiar resumo" não pode vazar.
  vi.unstubAllGlobals();
});
