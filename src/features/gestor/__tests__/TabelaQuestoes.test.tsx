import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, userEvent, fireEvent } from '@/test/utils';
import {
  TabelaQuestoes,
  deveMostrarQuestoes,
  formatNumeroQuestao,
  ORDENACOES_QUESTOES,
} from '@/features/gestor/components/TabelaQuestoes';
import { derivarDistratorDominante } from '@/features/gestor/charts/DistribuicaoAlternativas';
import type { Alternativa, Meta, Questao } from '@/features/gestor/api/types';

const alternativas = (): Alternativa[] => [
  { letra: 'A', texto: 'Alternativa A', correta: true, marcadaPct: 42 },
  { letra: 'B', texto: 'Alternativa B', correta: false, marcadaPct: 31 },
  { letra: 'C', texto: 'Alternativa C', correta: false, marcadaPct: 15 },
  { letra: 'D', texto: 'Alternativa D', correta: false, marcadaPct: 8 },
  { letra: 'E', texto: 'Alternativa E', correta: false, marcadaPct: 4 },
];

const questao = (over: Partial<Questao>): Questao => ({
  numero: 1,
  grandeArea: 'Clínica Médica',
  especialidade: 'Cardiologia',
  tema: 'Insuficiência cardíaca',
  acertoPct: 42,
  enunciado: 'Paciente de 62 anos com dispneia progressiva…',
  alternativas: alternativas(),
  ...over,
});

const QUESTOES = [
  questao({ numero: 1 }),
  questao({ numero: 2, grandeArea: 'Cirurgia', especialidade: 'Cirurgia geral', tema: 'Abdome agudo', acertoPct: 28 }),
];

const props = (over: Partial<React.ComponentProps<typeof TabelaQuestoes>> = {}) => ({
  questoes: QUESTOES,
  total: 2,
  page: 1,
  pageSize: 20,
  onPageChange: vi.fn(),
  ordenacao: 'ordem_da_prova' as const,
  onOrdenacaoChange: vi.fn(),
  areas: ['Clínica Médica', 'Cirurgia'],
  areaSelecionada: null,
  onAreaChange: vi.fn(),
  ...over,
});

describe('deveMostrarQuestoes (§4.7.3-4, §12 caso 6)', () => {
  it('só com exatamente 1 simulado', () => {
    expect(deveMostrarQuestoes([])).toBe(false);
    expect(deveMostrarQuestoes(['s1'])).toBe(true);
    expect(deveMostrarQuestoes(['s1', 's2'])).toBe(false);
  });
});

describe('formatNumeroQuestao', () => {
  it('prefixa Q e completa dois dígitos, como a referência imprime', () => {
    expect(formatNumeroQuestao(4)).toBe('Q04');
    expect(formatNumeroQuestao(37)).toBe('Q37');
    expect(formatNumeroQuestao(112)).toBe('Q112');
  });
});

describe('derivarDistratorDominante', () => {
  it('escolhe a incorreta mais marcada', () => {
    expect(derivarDistratorDominante(alternativas())).toBe('B');
  });

  it('devolve undefined quando ninguém marcou incorreta', () => {
    expect(
      derivarDistratorDominante([
        { letra: 'A', texto: 'a', correta: true, marcadaPct: 100 },
        { letra: 'B', texto: 'b', correta: false, marcadaPct: 0 },
      ]),
    ).toBeUndefined();
  });

  it('ignora null como se ninguém tivesse marcado (nunca vira 0 disfarçado)', () => {
    expect(
      derivarDistratorDominante([
        { letra: 'A', texto: 'a', correta: true, marcadaPct: null },
        { letra: 'B', texto: 'b', correta: false, marcadaPct: null },
      ]),
    ).toBeUndefined();
  });
});

describe('TabelaQuestoes', () => {
  beforeEach(() => {
    // O filtro de grande área é um Radix Select, que chama scrollIntoView e
    // hasPointerCapture ao abrir — nenhum dos dois existe no jsdom.
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('mostra as 6 colunas do detalhamento — a barra e o valor são colunas distintas', () => {
    render(<TabelaQuestoes {...props()} />);

    // Anatomia única de tabela do gestor (`components/tabela`), não o primitivo
    // `ui/table` compartilhado com aluno e admin.
    expect(screen.getByRole('table', { name: 'Detalhamento das questões' })).toBeInTheDocument();

    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual([
      'Nº',
      'Grande área',
      'Especialidade',
      'Tema',
      'Índice de acerto',
      // Visualmente vazio na referência, mas nomeado para o leitor de tela.
      'Percentual de acerto',
    ]);
  });

  it('o Nº é Q + dois dígitos em fonte mono, não o inteiro cru', () => {
    render(<TabelaQuestoes {...props({ questoes: [questao({ numero: 4 })], total: 1 })} />);

    const gatilho = screen.getByRole('button', { name: /Ver detalhe da questão 4/i });
    expect(gatilho).toHaveTextContent('Q04');
    // Handoff §3: número em tabela é Roboto Mono, a mesma família (FONTE_MONO)
    // que a régua de tabela do gestor aplica nas colunas numéricas.
    expect(gatilho.style.fontFamily).toContain('Roboto Mono');
  });

  it('a coluna de índice de acerto tem barra colorida pela régua única, e o crítico marca o valor', () => {
    render(<TabelaQuestoes {...props()} />);

    // 42% = mediano, 28% = crítico (lib/regras.nivelDesempenho).
    expect(screen.getByTestId('barra-acerto-1')).toBeInTheDocument();
    const critica = screen.getByTestId('linha-questao-2');
    expect(within(critica).getByText('28%').className).toMatch(/gp-text-danger/);
    // O mediano não é pintado de vermelho.
    const mediana = screen.getByTestId('linha-questao-1');
    expect(within(mediana).getByText('42%').className).not.toMatch(/gp-text-danger/);
  });

  it('acertoPct null não desenha barra e mostra TRACO (§4.10)', () => {
    render(<TabelaQuestoes {...props({ questoes: [questao({ numero: 9, acertoPct: null })], total: 1 })} />);

    expect(screen.queryByTestId('barra-acerto-9')).toBeNull();
    expect(screen.getByTestId('linha-questao-9')).toHaveTextContent('—');
  });

  it('oferece as 3 ordenações decididas em 24/07 e nenhum slider', async () => {
    const user = userEvent.setup();
    const onOrdenacaoChange = vi.fn();
    render(<TabelaQuestoes {...props({ onOrdenacaoChange })} />);

    expect(ORDENACOES_QUESTOES.map((o) => o.rotulo)).toEqual(['Ordem da prova', 'Mais erradas', 'Mais acertadas']);
    // ToggleGroup type="single" (Radix) usa o padrão radiogroup — role="radio" + aria-checked, não button/aria-pressed.
    expect(screen.getByRole('radio', { name: 'Ordem da prova' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('slider')).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Mais erradas' }));
    expect(onOrdenacaoChange).toHaveBeenCalledWith('mais_erradas');
  });

  /**
   * `title` em botão `disabled` não chega a ninguém: controle desabilitado não
   * dispara evento de mouse, então Chrome e Firefox nunca mostram a tooltip. O
   * motivo tem que ser TEXTO NA TELA ao lado do controle, como o
   * `motivo-sem-cruzamento` de `AcertoPorAreaESemestre`.
   */
  it('"Mais acertadas" segue desabilitada e o motivo é texto na tela, não só title', () => {
    render(<TabelaQuestoes {...props()} />);

    const opcao = screen.getByRole('radio', { name: 'Mais acertadas' });
    expect(opcao).toBeDisabled();
    expect(opcao).toHaveAttribute('title', expect.stringContaining('Indisponível'));

    const motivo = screen.getByTestId('motivo-ordenacao-mais_acertadas');
    expect(motivo).toBeVisible();
    expect(motivo).toHaveTextContent('o banco ainda não ordena por acerto decrescente');
    // `aria-describedby` aponta para o texto real da tela; `aria-description`
    // não é texto na tela e tem suporte parcial.
    expect(opcao).toHaveAttribute('aria-describedby', motivo.id);
    expect(opcao).not.toHaveAttribute('aria-description');

    // Ordenação disponível não ganha linha de motivo — o aviso é do que falta.
    expect(screen.queryByTestId('motivo-ordenacao-mais_erradas')).toBeNull();
    expect(screen.queryByTestId('motivo-ordenacao-ordem_da_prova')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Mais erradas' })).not.toHaveAttribute('aria-describedby');
  });

  it('a grande área é um dropdown (não um segmentado) e filtra pelo callback, sem filtrar no cliente', async () => {
    const onAreaChange = vi.fn();
    render(<TabelaQuestoes {...props({ onAreaChange })} />);

    // A referência reserva o segmentado para a ordenação; a área é um Select,
    // porque a lista cresce com o recorte e estouraria a toolbar.
    const combo = screen.getByRole('combobox', { name: /grande área/i });
    expect(combo).toHaveTextContent('Todas');
    expect(screen.queryByRole('radio', { name: 'Cirurgia' })).toBeNull();

    fireEvent.click(combo);
    fireEvent.click(
      await screen.findByText('Cirurgia', { selector: '[role="option"] *, [role="option"]' }),
    );

    expect(onAreaChange).toHaveBeenCalledWith('Cirurgia');
    expect(screen.getAllByTestId(/^linha-questao-/)).toHaveLength(2);
  });

  it('expande a linha com enunciado, alternativas A-E e distribuição', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props()} />);

    const gatilho = screen.getByRole('button', { name: /Ver detalhe da questão 1/i });
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');

    await user.click(gatilho);
    expect(gatilho).toHaveAttribute('aria-expanded', 'true');

    const detalhe = screen.getByTestId('detalhe-questao-1');
    expect(within(detalhe).getByText(/dispneia progressiva/)).toBeInTheDocument();
    expect(within(detalhe).getAllByTestId(/^alternativa-/)).toHaveLength(5);
    expect(within(detalhe).getAllByTestId(/^distribuicao-[A-E]$/)).toHaveLength(5);
    expect(within(detalhe).getByTestId('alternativa-A')).toHaveAttribute('data-correta', 'true');
    expect(within(detalhe).getByTestId('alternativa-A')).toHaveTextContent('alternativa correta');
    expect(within(detalhe).getByTestId('alternativa-B')).toHaveTextContent('distrator dominante');
    expect(within(detalhe).getByTestId('distribuicao-B')).toHaveTextContent('31%');
  });

  it('a distribuição traz legenda por extenso e a frase de leitura do distrator', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props()} />);

    await user.click(screen.getByRole('button', { name: /Ver detalhe da questão 1/i }));

    const detalhe = screen.getByTestId('detalhe-questao-1');
    // Cor nunca é o único canal: os dois papéis têm rótulo textual.
    expect(within(detalhe).getByText('correta')).toBeInTheDocument();
    expect(within(detalhe).getByText('distrator mais marcado')).toBeInTheDocument();
    expect(within(detalhe).getByTestId('distribuicao-leitura')).toHaveTextContent(
      'o distrator B domina',
    );
  });

  it('respeita o distrator dominante vindo do servidor', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props({ questoes: [questao({ numero: 1, distratorDominante: 'C' })] })} />);

    await user.click(screen.getByRole('button', { name: /Ver detalhe da questão 1/i }));
    expect(screen.getByTestId('alternativa-C')).toHaveTextContent('distrator dominante');
    expect(screen.getByTestId('alternativa-B')).not.toHaveTextContent('distrator dominante');
  });

  it('alternativa com marcadaPct null mostra TRACO, não 0% (§4.10)', async () => {
    const user = userEvent.setup();
    render(
      <TabelaQuestoes
        {...props({
          questoes: [
            questao({
              numero: 1,
              alternativas: [
                { letra: 'A', texto: 'Alternativa A', correta: true, marcadaPct: null },
                { letra: 'B', texto: 'Alternativa B', correta: false, marcadaPct: null },
              ],
            }),
          ],
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Ver detalhe da questão 1/i }));
    expect(screen.getByTestId('distribuicao-A')).toHaveTextContent('—');
  });

  it('o rodapé diz quantas de quantas, e só cita a proveniência quando ela existe', () => {
    const meta: Meta = {
      periodo: '2026.1',
      fonte: 'gabarito oficial',
      atualizadoEm: '2026-05-12T10:00:00Z',
      criterio: 'acerto por questão',
      partial: false,
      lowSample: false,
    };
    const { rerender } = render(<TabelaQuestoes {...props({ total: 100 })} />);
    expect(screen.getByTestId('questoes-rodape')).toHaveTextContent('Mostrando 2 de 100 questões');
    expect(screen.getByTestId('questoes-rodape')).not.toHaveTextContent('fonte:');

    rerender(<TabelaQuestoes {...props({ total: 100, meta })} />);
    expect(screen.getByTestId('questoes-rodape')).toHaveTextContent(
      'Mostrando 2 de 100 questões · fonte: gabarito oficial · atualizado 12/05/2026',
    );
  });

  it('usa a paginação única do gestor: anterior, números, próxima, com a atual marcada', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<TabelaQuestoes {...props({ total: 100, page: 3, onPageChange })} />);

    const nav = screen.getByRole('navigation', { name: 'Paginação das questões' });
    expect(within(nav).getByRole('button', { name: 'Página 3' })).toHaveAttribute('aria-current', 'page');
    // Os números SÃO o controle: a primeira e a última página estão sempre a um
    // clique, sem botão dedicado de "primeira" (componente `tabela/Paginacao`).
    expect(within(nav).getByRole('button', { name: 'Página 1' })).toBeEnabled();
    expect(within(nav).getByRole('button', { name: 'Página 5' })).toBeEnabled();
    expect(within(nav).getByRole('button', { name: 'Página anterior' })).toBeEnabled();
    expect(within(nav).getByRole('button', { name: 'Próxima página' })).toBeEnabled();

    await user.click(within(nav).getByRole('button', { name: 'Página 1' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('gabarito em processamento: mensagem, nenhuma linha e nenhum número (§4.10)', () => {
    render(<TabelaQuestoes {...props({ questoes: [], total: 0, processando: true })} />);

    const bloco = screen.getByTestId('questoes-processando');
    expect(bloco).toHaveTextContent('Gabarito em processamento');
    // A mensagem aponta para onde AINDA existe número, em vez de só negar.
    expect(bloco).toHaveTextContent('As métricas gerais do simulado já podem ser consultadas acima.');
    expect(screen.queryByTestId(/^linha-questao-/)).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
