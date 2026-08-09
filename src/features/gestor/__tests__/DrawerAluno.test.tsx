import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// `@/test/utils` e não o `render` cru: o rodapé do drawer é o `AcoesRecorte`,
// que lê o recorte da URL (`useFiltrosGestor` → `useSearchParams`) e portanto
// exige um Router montado. Mesmo wrapper de DrawerTemas.test.tsx.
import { act, render, screen, userEvent, waitFor, within } from '@/test/utils';
import { DrawerAluno, linkWhatsAppAluno } from '@/features/gestor/components/DrawerAluno';
import { ATRASO_SKELETON_MS } from '@/features/gestor/hooks/useDelayedLoading';
import {
  useAluno,
  useAlunoContato,
  useAlunoDesempenhoPorArea,
  useGestorContexto,
} from '@/features/gestor/api/queries';
import { TRACO } from '@/features/gestor/lib/formatters';
import type { AlunoContato, AlunoSimuladoEntry, Meta } from '@/features/gestor/api/types';
import type { AreaDesempenhoAluno, DesempenhoPorAreaSimulado } from '@/features/gestor/api/types-aluno-area';

// O `<Toaster />` não faz parte do wrapper de teste: sem interceptar o hook, o
// aviso de "exportação indisponível" não teria onde aparecer para ser afirmado.
const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

// "Insight do aluno (IA)" chama `supabase.functions.invoke` direto (mesmo
// padrão de `AiRecommendationCard`) — sem este mock, o clique em "Gerar com
// IA" bateria numa rede de verdade.
const { mockFunctionsInvoke } = vi.hoisted(() => ({ mockFunctionsInvoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) } },
}));

vi.mock('@/features/gestor/api/queries', () => ({
  useAluno: vi.fn(),
  useAlunoContato: vi.fn(),
  // Drill-down grande área → especialidade → tema (task 09/08) — consulta
  // própria, precisa do próprio mock para o drawer não quebrar ao montar.
  useAlunoDesempenhoPorArea: vi.fn(),
  // O rodapé de ações é o `AcoesRecorte`, que lê `podeExportar` do contexto
  // resolvido no SERVIDOR — o mock do módulo precisa expor este hook também.
  useGestorContexto: vi.fn(),
}));

const mockUseAluno = vi.mocked(useAluno);
const mockUseAlunoContato = vi.mocked(useAlunoContato);
const mockUseAlunoDesempenhoPorArea = vi.mocked(useAlunoDesempenhoPorArea);
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

/**
 * Fixture do drill-down grande área → especialidade → tema
 * (`get_gestor_aluno_desempenho_por_area`). Duas especialidades em "Clínica
 * Médica" (uma delas com tema crítico) e uma em "Cirurgia" — o mínimo para
 * exercitar agrupamento, contagem de críticos e os dois níveis de acordeão.
 */
const AREA_CARDIO: AreaDesempenhoAluno = {
  grandeArea: 'Clínica Médica',
  especialidade: 'Cardiologia',
  tema: 'Insuficiência cardíaca',
  questoesRespondidas: 9,
  questoesTotal: 10,
  acertoPct: 90,
  critica: false,
};

const AREA_NEONATO_CRITICA: AreaDesempenhoAluno = {
  grandeArea: 'Clínica Médica',
  especialidade: 'Neonatologia',
  tema: 'Ictericia neonatal',
  questoesRespondidas: 4,
  questoesTotal: 10,
  acertoPct: 40,
  critica: true,
};

const AREA_TRAUMA: AreaDesempenhoAluno = {
  grandeArea: 'Cirurgia',
  especialidade: 'Trauma',
  tema: 'Politrauma',
  questoesRespondidas: 7,
  questoesTotal: 10,
  acertoPct: 70,
  critica: false,
};

const DESEMPENHO_AREA_S2: DesempenhoPorAreaSimulado = {
  simuladoId: 's2',
  nome: 'Simulado 2',
  areas: [AREA_CARDIO, AREA_NEONATO_CRITICA, AREA_TRAUMA],
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
  // Drill-down por área — default sem dado (nenhum teste deste arquivo é
  // sobre ele); os testes dedicados sobrescrevem com `mockReturnValue`.
  mockUseAlunoDesempenhoPorArea.mockReturnValue(
    resultado({ data: [] }) as unknown as ReturnType<typeof useAlunoDesempenhoPorArea>,
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
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Regra dos 400ms (spec de motion §7, `useDelayedLoading`): o skeleton só
   * aparece depois do atraso — antes disso, resposta rápida não pisca nada.
   */
  it('loading: antes dos 400ms não mostra skeleton (regra dos 400ms)', () => {
    mockUseAluno.mockReturnValue(resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useAluno>);
    vi.useFakeTimers();
    montar();
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Ana Prado/);
    expect(screen.queryByTestId('drawer-aluno-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByText('Proficiência')).not.toBeInTheDocument();
  });

  it('loading: skeleton acessível em grade 2×2 + barras, depois dos 400ms', () => {
    mockUseAluno.mockReturnValue(resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useAluno>);
    vi.useFakeTimers();
    montar();
    act(() => {
      vi.advanceTimersByTime(ATRASO_SKELETON_MS + 1);
    });
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Ana Prado/);
    expect(screen.getByTestId('drawer-aluno-skeleton')).toBeInTheDocument();
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
  });

  /**
   * O comparativo é UM só, e é RECORTADO ao simulado mais recente — nunca
   * fundido. `acertoPorArea` existe por simulado; tirar média por área entre
   * simulados produziria número que a RPC não devolve, que é a mesma regra
   * de agregação honesta que proíbe média de Conceito ENAMED.
   */
  it('o comparativo por grande área vem do simulado mais recente, e diz de qual', () => {
    mockUseAluno.mockReturnValue(
      resultado({ data: [ENTRADA_S1, ENTRADA_S2] }) as unknown as ReturnType<typeof useAluno>,
    );
    // A cascata única é o comparativo: o nível 1 usa o % que a RPC do simulado
    // devolve em `acertoPorArea`, e só existe casado com o MESMO simuladoId.
    mockUseAlunoDesempenhoPorArea.mockReturnValue(
      resultado({ data: [DESEMPENHO_AREA_S2] }) as unknown as ReturnType<typeof useAlunoDesempenhoPorArea>,
    );
    montar();

    const areas = screen.getByTestId('drawer-areas');
    // S2 (12/05) é o mais recente; S1 (10/03) não entra no comparativo.
    expect(areas).toHaveTextContent('Simulado 2');
    expect(areas).toHaveTextContent('55%');
    expect(areas).not.toHaveTextContent('42%');
    // E nada de média entre os dois (42 e 55 dariam 48,5).
    expect(areas.textContent).not.toMatch(/48[.,]5/);
  });

  /**
   * Sem área crítica, quatro barras sem leitura não são um insight. A
   * referência sempre fecha o painel nomeando uma área — quando não há
   * crítica, é o destaque, com a menor citada na mesma frase.
   */
  it('sem área crítica, o insight nomeia o destaque em vez de silenciar', () => {
    mockUseAluno.mockReturnValue(
      resultado({
        data: [
          {
            ...ENTRADA_S2,
            acertoPorArea: [
              { area: 'Cirurgia', acertoPct: 81, critica: false },
              { area: 'Pediatria', acertoPct: 54, critica: false },
            ],
          },
        ],
      }) as unknown as ReturnType<typeof useAluno>,
    );
    montar();

    const destaque = screen.getByTestId('drawer-area-destaque-s2');
    expect(destaque).toHaveTextContent('Destaque do aluno');
    expect(destaque).toHaveTextContent('Cirurgia · 81% de acerto');
    expect(destaque).toHaveTextContent('Menor acerto: Pediatria · 54%');
    expect(screen.queryByTestId('drawer-area-critica-s2')).not.toBeInTheDocument();
  });

  /**
   * As notas viram uma LISTA — uma linha por simulado —, não um cartão de
   * meia tela repetido por simulado. Os campos que moravam nas caixas de
   * métrica (acertos, posição, percentil, variação) seguem na linha de apoio.
   */
  it('lista as notas dos simulados sem perder acertos, posição e variação', () => {
    mockUseAluno.mockReturnValue(
      resultado({ data: [ENTRADA_S1, ENTRADA_S2] }) as unknown as ReturnType<typeof useAluno>,
    );
    montar();

    const linha = screen.getByTestId('drawer-simulado-s1');
    expect(linha).toHaveTextContent('Simulado 1');
    expect(linha).toHaveTextContent('71 acertos');
    expect(linha).toHaveTextContent('12º de 118 · percentil 90');
    expect(linha).toHaveTextContent('+3 vs anterior');
    expect(screen.getByTestId('drawer-proficiencia-s1')).toHaveTextContent('71');
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
/**
 * "Enviar no WhatsApp" (reunião de 07/08). Leva o MESMO resumo agregado do
 * "Copiar resumo" — nunca lista nominal de terceiros (§7.7) — para o telefone
 * do próprio aluno.
 */
describe('DrawerAluno — falar com o aluno no WhatsApp', () => {
  it('monta o link com DDI, só dígitos e o resumo no texto', () => {
    expect(linkWhatsAppAluno('(11) 98888-7777', 'oi')).toBe('https://wa.me/5511988887777?text=oi');
  });

  /** Número já cadastrado com DDI não pode virar `5555…`. */
  it('não duplica o DDI quando o número já vem com ele', () => {
    expect(linkWhatsAppAluno('5511988887777', 'oi')).toBe('https://wa.me/5511988887777?text=oi');
  });

  it('sem telefone, não há link — e o botão não aparece', () => {
    expect(linkWhatsAppAluno(null, 'oi')).toBeNull();
    expect(linkWhatsAppAluno('', 'oi')).toBeNull();

    mockUseAlunoContato.mockReturnValue(
      resultado({ data: { id: 'a1', telefone: null } }) as unknown as ReturnType<typeof useAlunoContato>,
    );
    montar();
    expect(screen.queryByTestId('drawer-whatsapp')).not.toBeInTheDocument();
  });

  it('com telefone, oferece o botão', () => {
    montar();
    expect(screen.getByTestId('drawer-whatsapp')).toHaveTextContent('Enviar no WhatsApp');
  });
});

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

/**
 * Drill-down grande área → especialidade → tema (task 09/08), consulta
 * própria (`useAlunoDesempenhoPorArea`). Loading/erro/vazio seguem o mesmo
 * padrão de bloco independente do resto do drawer (spec de degradação
 * graciosa já usada em `drawer-areas`/`drawer-evolucao`).
 */
describe('DrawerAluno — desempenho por área/especialidade/tema (drill-down)', () => {
  it('carregando: mostra skeleton do bloco, nunca a cascata', () => {
    mockUseAlunoDesempenhoPorArea.mockReturnValue(
      resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useAlunoDesempenhoPorArea>,
    );
    montar();
    expect(screen.getByRole('status', { name: 'Carregando desempenho por área' })).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-cascata-areas')).not.toBeInTheDocument();
  });

  it('erro: mensagem + Tentar novamente refaz só esta consulta, sem derrubar o resto do drawer', async () => {
    const refetch = vi.fn();
    mockUseAlunoDesempenhoPorArea.mockReturnValue(
      resultado({ data: undefined, isError: true, refetch }) as unknown as ReturnType<typeof useAlunoDesempenhoPorArea>,
    );
    const user = userEvent.setup();
    montar();

    const bloco = screen.getByTestId('drawer-desempenho-area');
    expect(within(bloco).getByRole('alert')).toBeInTheDocument();
    await user.click(within(bloco).getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
    // O resto do drawer segue disponível — a falha é só deste bloco.
    expect(screen.getByText('Proficiência')).toBeInTheDocument();
  });

  it('sem classificação por tema no recorte, mostra vazio — nunca quebra', () => {
    // beforeEach já monta `useAlunoDesempenhoPorArea` com `data: []`.
    montar();
    expect(
      within(screen.getByTestId('drawer-desempenho-area')).getByText('Sem classificação por tema neste recorte'),
    ).toBeInTheDocument();
  });

  it('usa o simulado MAIS RECENTE com classificação — nunca funde entre simulados', () => {
    mockUseAluno.mockReturnValue(
      resultado({ data: [ENTRADA_S1, ENTRADA_S2] }) as unknown as ReturnType<typeof useAluno>,
    );
    mockUseAlunoDesempenhoPorArea.mockReturnValue(
      resultado({ data: [DESEMPENHO_AREA_S2] }) as unknown as ReturnType<typeof useAlunoDesempenhoPorArea>,
    );
    montar();
    expect(screen.getByTestId('drawer-desempenho-area')).toHaveTextContent('Simulado 2');
  });

  it('grande área expande para especialidade, que expande para o tema — com % em todos os níveis', async () => {
    // `DESEMPENHO_AREA_S2` é do simulado 's2' — sem isso no recorte de
    // `useAluno`, o casamento por `simuladoId` (regra de agregação honesta)
    // não encontra o simulado e a seção cai no vazio, não na cascata.
    mockUseAluno.mockReturnValue(
      resultado({ data: [ENTRADA_S2] }) as unknown as ReturnType<typeof useAluno>,
    );
    mockUseAlunoDesempenhoPorArea.mockReturnValue(
      resultado({ data: [DESEMPENHO_AREA_S2] }) as unknown as ReturnType<typeof useAlunoDesempenhoPorArea>,
    );
    const user = userEvent.setup();
    montar();

    // Nível 1: grande área com o SEU % de acerto — aqui vem de `acertoPorArea`
    // do próprio simulado (55%), que prevalece sobre o valor recalculado.
    // Nenhuma contagem de temas/especialidades: a métrica é sempre o % (09/08).
    const grandeArea = screen.getByTestId('drawer-grande-area-Clínica Médica');
    expect(grandeArea).toHaveTextContent('55%');
    expect(grandeArea.textContent).not.toMatch(/tema|crítico/i);
    expect(screen.queryByTestId('drawer-especialidade-Neonatologia')).not.toBeInTheDocument();

    await user.click(grandeArea);
    expect(screen.getByTestId('drawer-especialidade-Neonatologia')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-especialidade-Cardiologia')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-tema-Ictericia neonatal')).not.toBeInTheDocument();

    // Nível 2: a especialidade também tem % — ponderado pelas questões
    // respondidas dos seus temas (Neonatologia tem só o tema de 40%).
    const especialidade = screen.getByTestId('drawer-especialidade-Neonatologia');
    expect(especialidade).toHaveTextContent('40%');

    await user.click(especialidade);
    const tema = screen.getByTestId('drawer-tema-Ictericia neonatal');
    expect(tema).toHaveTextContent('40%');
    // Cor nunca é canal único: a criticidade também sai por texto.
    expect(screen.getAllByText(/\(crítico\)/).length).toBeGreaterThan(0);
  });
});

/**
 * "Insight do aluno (IA)" (task 09/08) — `supabase.functions.invoke`, sob
 * clique, nunca ao abrir o drawer. Degradação graciosa: qualquer falha
 * esconde o resultado e cai num estado discreto com "Tentar novamente".
 *
 * SKIP (09/08): a seção está ocultada em produção (`MOSTRAR_INSIGHT_IA =
 * false` em `DrawerAluno.tsx`) por decisão de produto — o botão "Gerar com
 * IA" não existe na árvore enquanto isso valer. Reativar junto da flag.
 */
describe.skip('DrawerAluno — insight do aluno por IA', () => {
  it('não chama a IA ao abrir o drawer — só sob clique do usuário', () => {
    montar();
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Gerar com IA' })).toBeInTheDocument();
  });

  it('ao clicar, mostra skeleton e depois o texto retornado, com o payload certo', async () => {
    // Promise represada de propósito: com `mockResolvedValue` puro, a
    // resolução cai no mesmo microtask flush do próprio `user.click`, e o
    // teste nunca observa o estado 'carregando' — represar é o que garante
    // a janela para afirmar o skeleton antes de liberar o resultado.
    let resolverInvoke: (valor: unknown) => void = () => undefined;
    mockFunctionsInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverInvoke = resolve;
        }),
    );
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: 'Gerar com IA' }));
    expect(screen.getByTestId('drawer-insight-ia-carregando')).toBeInTheDocument();
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('gestor-ai-insights', {
      body: { modo: 'aluno', iesId: null, alunoId: 'a1', simulados: ['s1', 's2'] },
    });

    resolverInvoke({ data: { insight: 'Este aluno evoluiu bem em Clínica Médica.' }, error: null });

    await waitFor(() =>
      expect(screen.getByTestId('drawer-insight-ia-texto')).toHaveTextContent(
        'Este aluno evoluiu bem em Clínica Médica.',
      ),
    );
  });

  it('em erro, esconde o resultado e mostra estado discreto com opção de tentar de novo — sem quebrar o drawer', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: new Error('edge function failed') });
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: 'Gerar com IA' }));
    await waitFor(() => expect(screen.getByTestId('drawer-insight-ia-erro')).toBeInTheDocument());
    expect(screen.queryByTestId('drawer-insight-ia-texto')).not.toBeInTheDocument();
    // O resto do drawer segue de pé — a IA nunca trava o componente.
    expect(screen.getByText('Proficiência')).toBeInTheDocument();

    mockFunctionsInvoke.mockResolvedValue({ data: { insight: 'Recuperou no retry.' }, error: null });
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() =>
      expect(screen.getByTestId('drawer-insight-ia-texto')).toHaveTextContent('Recuperou no retry.'),
    );
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
