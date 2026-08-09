import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, userEvent } from '@/test/utils';
import {
  TabelaAlunosSimulado,
  classificarProficiencia,
  ordenarAlunosNoSimulado,
} from '@/features/gestor/components/TabelaAlunosSimulado';
import type { AlunoNoSimulado } from '@/features/gestor/api/types';

const aluno = (over: Partial<AlunoNoSimulado>): AlunoNoSimulado => ({
  id: 'a1',
  nome: 'Ana',
  semestre: 11,
  participou: true,
  acertos: 60,
  proficiencia: 72,
  situacao: 'proficiente',
  ...over,
});

const TRES: AlunoNoSimulado[] = [
  aluno({ id: 'a1', nome: 'Ana', acertos: 60, proficiencia: 72, situacao: 'proficiente' }),
  aluno({ id: 'a2', nome: 'Bruno', acertos: 40, proficiencia: 55, situacao: 'abaixo_do_limiar' }),
  aluno({
    id: 'a3',
    nome: 'Carla',
    participou: false,
    acertos: null,
    proficiencia: null,
    situacao: 'nao_participou',
  }),
];

const nomesNaOrdem = () =>
  screen
    .getAllByTestId(/^linha-aluno-/)
    .map((linha) => within(linha).getByTestId('celula-nome').textContent);

describe('ordenarAlunosNoSimulado', () => {
  it('ordena por proficiência decrescente com nulos sempre no fim (§4.10)', () => {
    const ordenado = ordenarAlunosNoSimulado(TRES, 'proficiencia', 'desc');
    expect(ordenado.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('mantém os nulos no fim também na ordem crescente', () => {
    const ordenado = ordenarAlunosNoSimulado(TRES, 'proficiencia', 'asc');
    expect(ordenado.map((a) => a.id)).toEqual(['a2', 'a1', 'a3']);
  });

  it('ordena por número de acertos', () => {
    expect(ordenarAlunosNoSimulado(TRES, 'acertos', 'desc').map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  });
});

describe('TabelaAlunosSimulado', () => {
  it('mostra as 5 colunas do simulado único e nenhuma coluna "Nota TRI" (§4.1, §12 caso 2)', () => {
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual(['Aluno', 'Semestre', 'Número de acertos', 'Proficiência', 'Situação']);
    expect(screen.queryByText(/nota tri/i)).toBeNull();
  });

  it('aluno que não participou aparece com travessão e badge, nunca com zero (§12 caso 7)', () => {
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    const carla = screen.getByTestId('linha-aluno-a3');
    expect(within(carla).getByTestId('celula-acertos')).toHaveTextContent('—');
    expect(within(carla).getByTestId('celula-proficiencia')).toHaveTextContent('—');
    expect(within(carla).getByText('Não participou')).toBeInTheDocument();
  });

  /**
   * A referência atenua a LINHA INTEIRA de quem não participou, não só as
   * células que já ficavam em `—` (acertos/proficiência). Nome e semestre
   * continuavam em texto cheio antes deste fix; agora caem em `--gp-text-3`
   * junto com o resto, no ramo sem `onSelecionarAluno` (span) e no ramo com
   * ele (botão).
   */
  it('atenua nome e semestre de quem não participou (linha inteira em text-3, §12)', () => {
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    const carla = screen.getByTestId('linha-aluno-a3');
    const nomeCarla = within(carla).getByTestId('celula-nome');
    expect(nomeCarla.querySelector('span[title="Carla"]')).toHaveStyle({ color: 'var(--gp-text-3)' });
    // Semestre reaproveita o mecanismo `ausente`, já usado por acertos/proficiência.
    expect(within(carla).getAllByRole('cell')[1].getAttribute('style')).toContain('color: var(--gp-text-3)');

    const ana = screen.getByTestId('linha-aluno-a1');
    const nomeAna = within(ana).getByTestId('celula-nome');
    expect(nomeAna.querySelector('span[title="Ana"]')).toHaveStyle({ color: 'var(--gp-text-1)' });
    expect(within(ana).getAllByRole('cell')[1].getAttribute('style')).not.toContain('color: var(--gp-text-3)');
  });

  it('atenua o nome também no ramo com onSelecionarAluno (botão)', () => {
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} onSelecionarAluno={vi.fn()} />);

    const carla = screen.getByTestId('linha-aluno-a3');
    const botaoCarla = within(carla).getByRole('button', { name: 'Carla' });
    expect(botaoCarla).toHaveStyle({ color: 'var(--gp-text-3)' });

    const ana = screen.getByTestId('linha-aluno-a1');
    const botaoAna = within(ana).getByRole('button', { name: 'Ana' });
    expect(botaoAna).toHaveStyle({ color: 'var(--gp-text-1)' });
  });

  /**
   * Achado F1 (revisão final): a linha SELECIONADA do não participante pinta
   * o fundo com `--gp-brand-surface` (item A4, agora opaco). `--gp-text-3`
   * contra essa superfície mede 3,98:1 — sub-AA num nome próprio. A linha
   * selecionada precisa usar `--gp-text-2` em vez de `--gp-text-3` — nos DOIS
   * ramos (botão e span) e também na célula de semestre — sem perder a
   * atenuação quando a linha NÃO está selecionada.
   */
  it('na linha selecionada, o não participante vai para --gp-text-2 (AA), nunca --gp-text-3 — ramo botão', async () => {
    const user = userEvent.setup();
    const onSelecionarAluno = vi.fn();
    const { rerender } = render(
      <TabelaAlunosSimulado alunos={TRES} multiSimulado={false} onSelecionarAluno={onSelecionarAluno} />,
    );

    rerender(
      <TabelaAlunosSimulado
        alunos={TRES}
        multiSimulado={false}
        alunoSelecionadoId="a3"
        onSelecionarAluno={onSelecionarAluno}
      />,
    );

    const carla = screen.getByTestId('linha-aluno-a3');
    expect(carla).toHaveAttribute('data-selecionado', 'true');

    const botaoCarla = within(carla).getByRole('button', { name: 'Carla' });
    expect(botaoCarla).toHaveStyle({ color: 'var(--gp-text-2)' });

    // Semestre (2ª célula) acompanha o mesmo par cor/superfície.
    expect(within(carla).getAllByRole('cell')[1].getAttribute('style')).toContain('color: var(--gp-text-2)');
    expect(within(carla).getAllByRole('cell')[1].getAttribute('style')).not.toContain('color: var(--gp-text-3)');

    // Um participante selecionado continua em text-1 — a atenuação relativa se mantém.
    await user.click(screen.getByRole('button', { name: 'Ana' }));
    expect(onSelecionarAluno).toHaveBeenCalledWith('a1');
  });

  it('na linha selecionada, o não participante vai para --gp-text-2 — ramo span (sem onSelecionarAluno)', () => {
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} alunoSelecionadoId="a3" />);

    const carla = screen.getByTestId('linha-aluno-a3');
    expect(carla).toHaveAttribute('data-selecionado', 'true');

    const nomeCarla = within(carla).getByTestId('celula-nome');
    expect(nomeCarla.querySelector('span[title="Carla"]')).toHaveStyle({ color: 'var(--gp-text-2)' });
    expect(within(carla).getAllByRole('cell')[1].getAttribute('style')).toContain('color: var(--gp-text-2)');
  });

  it('aluno que participou mas ainda não tem nota TRI aparece como "Aguardando resultado" (achado 03/08)', () => {
    render(
      <TabelaAlunosSimulado
        alunos={[
          aluno({ id: 'a5', nome: 'Diego', participou: true, acertos: 50, proficiencia: null, situacao: 'aguardando_resultado' }),
        ]}
        multiSimulado={false}
      />,
    );

    const linha = screen.getByTestId('linha-aluno-a5');
    expect(within(linha).getByText('Aguardando resultado')).toBeInTheDocument();
    expect(within(linha).getByTestId('celula-acertos')).toHaveTextContent('50');
    expect(within(linha).getByTestId('celula-proficiencia')).toHaveTextContent('—');
  });

  /**
   * A tabela ABRE ordenada por proficiência descendente: a referência mostra um
   * critério vigente no cabeçalho, e a ordem crua do array não é ordem nenhuma.
   * Por isso o primeiro clique na coluna vigente INVERTE a direção — não
   * "começa" a ordenação.
   */
  it('abre ordenada por proficiência desc e alterna a direção ao clicar no cabeçalho', async () => {
    const user = userEvent.setup();
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    expect(nomesNaOrdem()).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(screen.getByRole('columnheader', { name: /Proficiência/ })).toHaveAttribute('aria-sort', 'descending');

    await user.click(screen.getByRole('button', { name: /Proficiência/ }));
    expect(nomesNaOrdem()).toEqual(['Bruno', 'Ana', 'Carla']);
    expect(screen.getByRole('columnheader', { name: /Proficiência/ })).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByRole('button', { name: /Proficiência/ }));
    expect(nomesNaOrdem()).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(screen.getByRole('columnheader', { name: /Proficiência/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('ordena por qualquer coluna numérica, uma de cada vez', async () => {
    const user = userEvent.setup();
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    await user.click(screen.getByRole('button', { name: /Número de acertos/ }));
    expect(screen.getByRole('columnheader', { name: /Número de acertos/ })).toHaveAttribute('aria-sort', 'descending');
    // A coluna que perdeu a vez volta a "none" — nunca duas colunas ordenadas.
    expect(screen.getByRole('columnheader', { name: /Proficiência/ })).toHaveAttribute('aria-sort', 'none');
  });

  /**
   * §10.8: ordenar não pode embaralhar o vínculo linha↔dado. O risco real é
   * ordenar um array e renderizar outro; aqui a prova é que, depois de virar a
   * direção, cada nome continua com os SEUS números.
   */
  it('ordenar não desloca o dado de uma linha para a vizinha', async () => {
    const user = userEvent.setup();
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    await user.click(screen.getByRole('button', { name: /Proficiência/ }));

    const ana = screen.getByTestId('linha-aluno-a1');
    expect(within(ana).getByTestId('celula-nome')).toHaveTextContent('Ana');
    expect(within(ana).getByTestId('celula-acertos')).toHaveTextContent('60');
    expect(within(ana).getByTestId('celula-proficiencia')).toHaveTextContent('72');

    const bruno = screen.getByTestId('linha-aluno-a2');
    expect(within(bruno).getByTestId('celula-nome')).toHaveTextContent('Bruno');
    expect(within(bruno).getByTestId('celula-acertos')).toHaveTextContent('40');
    expect(within(bruno).getByTestId('celula-proficiencia')).toHaveTextContent('55');
  });

  /**
   * A ação vive no RODAPÉ, à esquerda, como a referência (`visibility_off` +
   * rótulo) — era um Switch do Radix no cabeçalho. O estado sai por
   * `aria-pressed`, e o contador do rodapé acompanha o filtro.
   */
  it('oculta não participantes sob demanda, e o contador acompanha', async () => {
    const user = userEvent.setup();
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(3);
    expect(screen.getByTestId('contador-linhas')).toHaveTextContent('Mostrando 3 de 3');

    const alternar = screen.getByRole('button', { name: /ocultar não participantes/i });
    expect(alternar).toHaveAttribute('aria-pressed', 'false');

    await user.click(alternar);
    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(2);
    expect(screen.queryByTestId('linha-aluno-a3')).toBeNull();
    expect(screen.getByTestId('contador-linhas')).toHaveTextContent('Mostrando 2 de 2');
    expect(screen.getByRole('button', { name: /ocultar não participantes/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    /**
     * O total de quem não participou é contado sobre TODOS os alunos, nunca
     * sobre a lista já filtrada — derivá-lo dos visíveis o zeraria justamente
     * quando ele é a informação.
     */
    expect(screen.getByTestId('contador-participacao')).toHaveTextContent('2 participantes · 1 sem participação');
  });

  it('pagina no cliente com o pager numerado, e a página atual é a única marcada', async () => {
    const user = userEvent.setup();
    const muitos = Array.from({ length: 25 }, (_, i) =>
      aluno({ id: `a${i}`, nome: `Aluno ${String(i).padStart(2, '0')}`, acertos: 100 - i, proficiencia: 90 - i }),
    );
    render(<TabelaAlunosSimulado alunos={muitos} multiSimulado={false} pageSize={20} />);

    const pager = () => screen.getByRole('navigation', { name: 'Paginação de alunos do simulado' });

    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(20);
    expect(screen.getByTestId('contador-linhas')).toHaveTextContent('Mostrando 20 de 25');
    expect(within(pager()).getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');
    expect(within(pager()).getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await user.click(within(pager()).getByRole('button', { name: 'Próxima página' }));

    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(5);
    expect(screen.getByTestId('contador-linhas')).toHaveTextContent('Mostrando 5 de 25');
    expect(within(pager()).getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
    expect(within(pager()).getByRole('button', { name: 'Próxima página' })).toBeDisabled();
  });

  /**
   * Seleção (referência, linha "Bruno Carvalho"): tint `--gp-brand-surface` na
   * linha inteira e barra de 3px da marca na PRIMEIRA célula. É o rastro que
   * diz de onde o drawer foi aberto quando ele fecha.
   */
  it('marca a linha selecionada com tint e barra de marca, e avisa o pai', async () => {
    const user = userEvent.setup();
    const onSelecionarAluno = vi.fn();
    const { rerender } = render(
      <TabelaAlunosSimulado alunos={TRES} multiSimulado={false} onSelecionarAluno={onSelecionarAluno} />,
    );

    await user.click(screen.getByRole('button', { name: 'Bruno' }));
    expect(onSelecionarAluno).toHaveBeenCalledWith('a2');

    rerender(
      <TabelaAlunosSimulado
        alunos={TRES}
        multiSimulado={false}
        alunoSelecionadoId="a2"
        onSelecionarAluno={onSelecionarAluno}
      />,
    );

    const bruno = screen.getByTestId('linha-aluno-a2');
    expect(bruno).toHaveAttribute('data-selecionado', 'true');
    expect(bruno.getAttribute('style')).toContain('background: var(--gp-brand-surface)');

    const primeiraCelula = within(bruno).getAllByRole('cell')[0];
    expect(primeiraCelula).toHaveAttribute('data-marca-selecao', 'true');
    expect(primeiraCelula.getAttribute('style')).toContain('border-left: 3px solid var(--gp-brand)');

    const ana = screen.getByTestId('linha-aluno-a1');
    expect(ana).toHaveAttribute('data-selecionado', 'false');
    expect(within(ana).getAllByRole('cell')[0]).not.toHaveAttribute('data-marca-selecao');
  });

  it('com 2+ simulados ganha a coluna Variação, só preenchida para quem participou de todos (§12 caso 8)', () => {
    render(
      <TabelaAlunosSimulado
        multiSimulado
        alunos={[
          aluno({ id: 'a1', nome: 'Ana', variacao: 7 }),
          aluno({ id: 'a2', nome: 'Bruno', variacao: -3 }),
          aluno({ id: 'a4', nome: 'Diego', variacao: null }),
        ]}
      />,
    );

    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual(['Aluno', 'Semestre', 'Número de acertos', 'Proficiência', 'Situação', 'Variação']);
    expect(within(screen.getByTestId('linha-aluno-a1')).getByTestId('celula-variacao')).toHaveTextContent('+7');
    expect(within(screen.getByTestId('linha-aluno-a2')).getByTestId('celula-variacao')).toHaveTextContent('-3');
    expect(within(screen.getByTestId('linha-aluno-a4')).getByTestId('celula-variacao')).toHaveTextContent('—');
  });

  it('com 1 simulado a coluna Variação não existe', () => {
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);
    expect(screen.queryByText('Variação')).toBeNull();
  });

  describe('classificarProficiencia', () => {
    it('>= 60 é proficiente', () => {
      expect(classificarProficiencia(60)).toBe('proficiente');
      expect(classificarProficiencia(100)).toBe('proficiente');
    });

    it('entre 45 e 59,99 é próximo da proficiência', () => {
      expect(classificarProficiencia(45)).toBe('proximo');
      expect(classificarProficiencia(59.99)).toBe('proximo');
    });

    it('< 45 é não proficiente', () => {
      expect(classificarProficiencia(44.99)).toBe('nao_proficiente');
      expect(classificarProficiencia(0)).toBe('nao_proficiente');
    });

    it('null (sem nota) não entra em nenhuma faixa', () => {
      expect(classificarProficiencia(null)).toBeNull();
    });
  });

  /**
   * Filtro de proficiência (decisão de produto desta sessão): 3 faixas sobre
   * o score TRI já carregado pela tabela — client-side, sem RPC nova.
   */
  describe('filtro de proficiência', () => {
    const QUATRO: AlunoNoSimulado[] = [
      aluno({ id: 'a1', nome: 'Ana', proficiencia: 72 }), // proficiente
      aluno({ id: 'a2', nome: 'Bruno', proficiencia: 50 }), // próximo
      aluno({ id: 'a3', nome: 'Carla', proficiencia: 30 }), // não proficiente
      aluno({ id: 'a4', nome: 'Diego', participou: false, proficiencia: null }), // sem nota
    ];

    it('mostra os 4 chips (Todos + 3 faixas) com contagem sobre TODOS os alunos', () => {
      render(<TabelaAlunosSimulado alunos={QUATRO} multiSimulado={false} />);

      const filtro = screen.getByTestId('filtro-proficiencia-alunos');
      expect(within(filtro).getByRole('button', { name: /Todos/ })).toHaveTextContent('3');
      expect(within(filtro).getByRole('button', { name: /Proficiente/ })).toHaveTextContent('1');
      expect(within(filtro).getByRole('button', { name: /Próximo da proficiência/ })).toHaveTextContent('1');
      expect(within(filtro).getByRole('button', { name: /Não proficiente/ })).toHaveTextContent('1');
    });

    it('filtra a tabela para a faixa selecionada, sem afetar a contagem dos outros chips', async () => {
      const user = userEvent.setup();
      render(<TabelaAlunosSimulado alunos={QUATRO} multiSimulado={false} />);

      await user.click(screen.getByRole('button', { name: /^Proficiente/ }));
      expect(nomesNaOrdem()).toEqual(['Ana']);

      const filtro = screen.getByTestId('filtro-proficiencia-alunos');
      expect(within(filtro).getByRole('button', { name: /Não proficiente/ })).toHaveTextContent('1');
      expect(within(filtro).getByRole('button', { name: /^Proficiente/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('aluno sem nota nunca aparece sob nenhuma faixa selecionada', async () => {
      const user = userEvent.setup();
      render(<TabelaAlunosSimulado alunos={QUATRO} multiSimulado={false} />);

      await user.click(screen.getByRole('button', { name: /Não proficiente/ }));
      expect(nomesNaOrdem()).toEqual(['Carla']);
      expect(screen.queryByText('Diego')).toBeNull();
    });

    it('clicar de novo na faixa ativa limpa o filtro (volta para Todos)', async () => {
      const user = userEvent.setup();
      render(<TabelaAlunosSimulado alunos={QUATRO} multiSimulado={false} />);

      // Cada clique re-consulta o botão: o chip é remontado a cada render
      // (mesmo padrão de `FiltroGrupoAlunos`), então reusar a referência do
      // primeiro clique apontaria para um nó já desmontado no segundo.
      await user.click(screen.getByRole('button', { name: /Próximo da proficiência/ }));
      expect(nomesNaOrdem()).toEqual(['Bruno']);

      await user.click(screen.getByRole('button', { name: /Próximo da proficiência/ }));
      expect(nomesNaOrdem()).toEqual(['Ana', 'Bruno', 'Carla', 'Diego']);
    });

    it('combina com "ocultar não participantes" (os dois filtros juntos)', async () => {
      const user = userEvent.setup();
      render(<TabelaAlunosSimulado alunos={QUATRO} multiSimulado={false} />);

      await user.click(screen.getByRole('button', { name: /ocultar não participantes/i }));
      expect(nomesNaOrdem()).toEqual(['Ana', 'Bruno', 'Carla']);

      await user.click(screen.getByRole('button', { name: /^Proficiente/ }));
      expect(nomesNaOrdem()).toEqual(['Ana']);
    });

    it('vazio com o filtro ativo oferece saída para mostrar todas as faixas', async () => {
      const user = userEvent.setup();
      const SO_NAO_PROFICIENTE: AlunoNoSimulado[] = [aluno({ id: 'a1', nome: 'Ana', proficiencia: 72 })];
      render(<TabelaAlunosSimulado alunos={SO_NAO_PROFICIENTE} multiSimulado={false} />);

      await user.click(screen.getByRole('button', { name: /Não proficiente/ }));
      expect(screen.getByText('Nenhum aluno com esse filtro')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /mostrar todas as faixas de proficiência/i }));
      expect(nomesNaOrdem()).toEqual(['Ana']);
    });
  });
});
