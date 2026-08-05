import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, userEvent } from '@/test/utils';
import {
  TabelaAlunosSimulado,
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

  it('ordena por qualquer coluna numérica ao clicar no cabeçalho', async () => {
    const user = userEvent.setup();
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    await user.click(screen.getByRole('button', { name: /Proficiência/ }));
    expect(nomesNaOrdem()).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(screen.getByRole('columnheader', { name: /Proficiência/ })).toHaveAttribute('aria-sort', 'descending');

    await user.click(screen.getByRole('button', { name: /Proficiência/ }));
    expect(nomesNaOrdem()).toEqual(['Bruno', 'Ana', 'Carla']);
    expect(screen.getByRole('columnheader', { name: /Proficiência/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('oculta não participantes sob demanda', async () => {
    const user = userEvent.setup();
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(3);
    await user.click(screen.getByRole('switch', { name: /ocultar não participantes/i }));
    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(2);
    expect(screen.queryByTestId('linha-aluno-a3')).toBeNull();
  });

  it('pagina no cliente', async () => {
    const user = userEvent.setup();
    const muitos = Array.from({ length: 25 }, (_, i) =>
      aluno({ id: `a${i}`, nome: `Aluno ${String(i).padStart(2, '0')}`, acertos: 100 - i, proficiencia: 90 - i }),
    );
    render(<TabelaAlunosSimulado alunos={muitos} multiSimulado={false} pageSize={20} />);

    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(20);
    expect(screen.getByTestId('paginacao')).toHaveTextContent('Página 1 de 2');

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });

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
    expect(bruno.className).toContain('bg-primary/5');
    expect(within(bruno).getByTestId('marca-selecao')).toBeInTheDocument();
    expect(screen.getByTestId('linha-aluno-a1')).toHaveAttribute('data-selecionado', 'false');
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
});
