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
  // Forma real de `get_gestor_questoes` desde 09/08 (migration
  // 20260809231000_..._respondentes.sql): as 3 chaves de imagem estão sempre
  // presentes no JSON, `null` quando a questão não tem imagem. `id` fica de
  // fora do default de propósito — a RPC real não o expõe (ver o comentário
  // de `Questao.id` em api/types.ts); testes que precisarem dele passam
  // `over.id` explicitamente.
  imagemEnunciado: null,
  imagemEnunciado2: null,
  imagemComentario: null,
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

  /**
   * Reunião de 07/08: "o detalhamento das questões tem que abrir clicando em
   * qualquer lugar, não só na seta". O alvo era um chevron de 14px numa linha
   * de largura de tela, e nada indicava que a linha respondia a clique.
   */
  it('abre o detalhe clicando em QUALQUER lugar da linha, não só na seta', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props()} />);

    const linha = screen.getByTestId('linha-questao-1');
    // Uma célula qualquer que NÃO seja o disclosure.
    await user.click(within(linha).getByText('Insuficiência cardíaca'));

    expect(within(linha).getByRole('button', { name: /Ver detalhe da questão 1/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(/Paciente de 62 anos/)).toBeInTheDocument();
  });

  /**
   * O disclosure continua sendo o controle acessível da linha. Sem o guard de
   * bubbling, o clique nele dispararia o handler do botão E o da linha — abrir
   * e fechar no mesmo gesto, deixando o detalhe inalcançável pelo próprio
   * controle que existe para abri-lo.
   */
  it('clicar no disclosure abre uma vez só — não abre e fecha no mesmo gesto', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props()} />);

    const gatilho = screen.getByRole('button', { name: /Ver detalhe da questão 1/ });
    await user.click(gatilho);
    expect(gatilho).toHaveAttribute('aria-expanded', 'true');

    await user.click(gatilho);
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');
  });

  it('o Nº é Q + dois dígitos em fonte mono, não o inteiro cru', () => {
    render(<TabelaQuestoes {...props({ questoes: [questao({ numero: 4 })], total: 1 })} />);

    const gatilho = screen.getByRole('button', { name: /Ver detalhe da questão 4/i });
    expect(gatilho).toHaveTextContent('Q04');
    // Handoff §3: número em tabela é Roboto Mono, a mesma família (FONTE_MONO)
    // que a régua de tabela do gestor aplica nas colunas numéricas.
    expect(gatilho.style.fontFamily).toContain('Roboto Mono');
  });

  /**
   * Mesma receita já usada nas duas tabelas de aluno (`TabelaAlunos.tsx`,
   * `TabelaAlunosSimulado.tsx`): `title` com o texto integral + `truncate`
   * na célula, para grande área/especialidade/tema não vazarem da coluna
   * quando o texto é longo (C3).
   */
  it('grande área, especialidade e tema truncam com title, como as tabelas de aluno (C3)', () => {
    render(
      <TabelaQuestoes
        {...props({
          questoes: [
            questao({
              numero: 1,
              grandeArea: 'Clínica Médica e Cirúrgica Combinadas em Regime Ambulatorial',
              especialidade: 'Cardiologia Intervencionista de Alta Complexidade',
              tema: 'Insuficiência cardíaca descompensada em paciente crônico grave',
            }),
          ],
          total: 1,
        })}
      />,
    );

    const linha = screen.getByTestId('linha-questao-1');
    const grandeArea = within(linha).getByTitle('Clínica Médica e Cirúrgica Combinadas em Regime Ambulatorial');
    expect(grandeArea).toHaveClass('truncate');
    const especialidade = within(linha).getByTitle('Cardiologia Intervencionista de Alta Complexidade');
    expect(especialidade).toHaveClass('truncate');
    const tema = within(linha).getByTitle('Insuficiência cardíaca descompensada em paciente crônico grave');
    expect(tema).toHaveClass('truncate');
  });

  it('a coluna de índice de acerto tem barra colorida pela régua única, e o crítico marca o valor', () => {
    render(<TabelaQuestoes {...props()} />);

    // 42% e 28% = crítico com o corte de 50 (lib/regras.nivelDesempenho).
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
   * `acerto_desc` confirmado em produção em 09/08 (`ORDER BY ... acerto_pct
   * DESC`) — "Mais acertadas" deixou de ser a única opção desabilitada das
   * três. Nenhuma das três precisa mais de `motivo`/`aria-describedby`.
   */
  it('"Mais acertadas" está habilitada e não tem nenhum motivo de indisponibilidade na tela', async () => {
    const user = userEvent.setup();
    const onOrdenacaoChange = vi.fn();
    render(<TabelaQuestoes {...props({ onOrdenacaoChange })} />);

    const opcao = screen.getByRole('radio', { name: 'Mais acertadas' });
    expect(opcao).not.toBeDisabled();
    expect(opcao).not.toHaveAttribute('title');
    expect(opcao).not.toHaveAttribute('aria-describedby');

    expect(screen.queryByTestId('motivo-ordenacao-mais_acertadas')).toBeNull();
    expect(screen.queryByTestId('motivo-ordenacao-mais_erradas')).toBeNull();
    expect(screen.queryByTestId('motivo-ordenacao-ordem_da_prova')).toBeNull();

    await user.click(opcao);
    expect(onOrdenacaoChange).toHaveBeenCalledWith('mais_acertadas');
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

  /**
   * `font-mono` do Tailwind não resolve para Roboto Mono (não há chave `mono`
   * em `tailwind.config.ts`) — o percentual por alternativa da distribuição
   * precisa da mesma `FONTE_MONO` que a coluna numérica da tabela já usa (C1).
   */
  it('o percentual da distribuição usa FONTE_MONO por style, não a classe font-mono (C1)', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props()} />);

    await user.click(screen.getByRole('button', { name: /Ver detalhe da questão 1/i }));

    const detalhe = screen.getByTestId('detalhe-questao-1');
    const pctA = within(detalhe)
      .getByTestId('distribuicao-A')
      .querySelector(':scope > span:last-child') as HTMLElement;
    expect(pctA.style.fontFamily).toContain('Roboto Mono');
    expect(pctA.className).not.toMatch(/\bfont-mono\b/);
  });

  /**
   * Na primeira lista (alternativa-A) a correta já se distingue por cor +
   * o rótulo por extenso "· alternativa correta". Na segunda lista
   * (distribuição), antes deste fix, a correta só tinha cor — o "✓" é o
   * canal redundante que falta ali (LIGHT.html imprime "24% ✓").
   */
  it('o percentual da alternativa correta na distribuição leva "✓" (C2)', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props()} />);

    await user.click(screen.getByRole('button', { name: /Ver detalhe da questão 1/i }));

    const detalhe = screen.getByTestId('detalhe-questao-1');
    expect(within(detalhe).getByTestId('distribuicao-A')).toHaveTextContent('42% ✓');
    expect(within(detalhe).getByTestId('distribuicao-B')).toHaveTextContent('31%');
    expect(within(detalhe).getByTestId('distribuicao-B')).not.toHaveTextContent('✓');
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
