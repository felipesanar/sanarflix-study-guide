import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { ProficienciaPorSemestreChart } from '@/features/gestor/charts/ProficienciaPorSemestreChart';
import type { AlunoNoSimulado } from '@/features/gestor/api/types';

/** Aluno mínimo — só os campos que o gráfico e a agregação leem. */
function aluno(overrides: Partial<AlunoNoSimulado>): AlunoNoSimulado {
  return {
    id: overrides.id ?? 'a',
    nome: overrides.nome ?? 'Fulano',
    semestre: overrides.semestre ?? null,
    participou: true,
    acertos: null,
    proficiencia: overrides.proficiencia ?? null,
    situacao: 'proficiente',
    ...overrides,
  };
}

const ALUNOS: AlunoNoSimulado[] = [
  aluno({ id: 'a1', nome: 'Beatriz', semestre: 11, proficiencia: 60 }),
  aluno({ id: 'a2', nome: 'Ana', semestre: 11, proficiencia: 80 }),
  aluno({ id: 'a3', semestre: 12, proficiencia: 90 }),
  aluno({ id: 'a4', semestre: 1, proficiencia: 50 }),
];

describe('ProficienciaPorSemestreChart — resumo por semestre', () => {
  it('renderiza uma barra por semestre, ordenada por número decrescente', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={ALUNOS}
        semestreAberto={null}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    const barras = screen.getAllByRole('button');
    expect(barras.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ver alunos do 12º semestre',
      'Ver alunos do 11º semestre',
      'Ver alunos do 1º semestre',
    ]);
  });

  it('mostra a média correta e a amostra por semestre', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={ALUNOS}
        semestreAberto={null}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    const barra11 = screen.getByTestId('proficiencia-semestre-11');
    expect(barra11).toHaveTextContent('11º semestre');
    expect(barra11).toHaveTextContent('2 alunos');
    expect(barra11).toHaveTextContent('70'); // média de 60 e 80

    const barra12 = screen.getByTestId('proficiencia-semestre-12');
    expect(barra12).toHaveTextContent('1 aluno'); // singular
    expect(barra12).toHaveTextContent('90');
  });

  it('clicar numa barra chama onAbrirSemestre com o semestre certo', async () => {
    const user = userEvent.setup();
    const onAbrirSemestre = vi.fn();
    render(
      <ProficienciaPorSemestreChart
        alunos={ALUNOS}
        semestreAberto={null}
        onAbrirSemestre={onAbrirSemestre}
        onSelecionarAluno={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ver alunos do 12º semestre' }));
    expect(onAbrirSemestre).toHaveBeenCalledWith(12);
  });

  it('o eixo mostra as notas 0/20/40/60/80/100, com o 60 destacado', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={ALUNOS}
        semestreAberto={null}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    ['0', '20', '40', '60', '80', '100'].forEach((n) => expect(screen.getByText(n)).toBeInTheDocument());
    const destaque = screen.getByTestId('eixo-meta');
    expect(destaque).toHaveTextContent('60');
    expect(destaque).toHaveStyle({ fontWeight: '700' });
  });

  /**
   * Refino de 10/08 (2ª rodada): a linha de meta deixou de ser uma peça por
   * barra e virou um overlay ÚNICO, contínuo do topo da lista até o eixo —
   * antes ela só existia sobre a trilha de 8px de cada barra e desaparecia
   * nos vãos entre elas.
   */
  it('a linha de meta é uma única, contínua — não uma por barra', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={ALUNOS}
        semestreAberto={null}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    const linhas = screen.getAllByTestId('linha-meta');
    expect(linhas.length).toBe(1);
    expect(linhas[0]).toHaveClass('absolute', 'inset-0');
    // A posição 60% mora na linha propriamente dita, dentro da coluna do
    // meio da grade compartilhada — não no overlay/grid externo.
    expect(linhas[0].querySelector('span > span')).toHaveStyle({ left: '60%' });
  });

  it('ignora alunos com proficiência nula na média', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={[aluno({ id: 'a1', semestre: 11, proficiencia: 80 }), aluno({ id: 'a2', semestre: 11, proficiencia: null })]}
        semestreAberto={null}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    expect(screen.getByTestId('proficiencia-semestre-11')).toHaveTextContent('80');
    expect(screen.getByTestId('proficiencia-semestre-11')).toHaveTextContent('1 aluno');
  });

  it('estado vazio quando nenhum aluno tem nota de proficiência', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={[aluno({ id: 'a1', semestre: 11, proficiencia: null })]}
        semestreAberto={null}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    expect(screen.getByTestId('proficiencia-semestre-vazio')).toHaveTextContent(
      'Sem alunos com resultado neste recorte.',
    );
  });

  it('undefined é "indisponível", nunca a mesma mensagem de lista vazia (§4.10)', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={undefined}
        semestreAberto={null}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    expect(screen.getByTestId('proficiencia-semestre-indisponivel')).toBeInTheDocument();
    expect(screen.queryByTestId('proficiencia-semestre-vazio')).not.toBeInTheDocument();
  });
});

describe('ProficienciaPorSemestreChart — drill-down inline por aluno', () => {
  it('semestreAberto mostra os alunos daquele semestre, ordenados por nota decrescente, dentro do mesmo componente', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={ALUNOS}
        semestreAberto={11}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    const drilldown = screen.getByTestId('proficiencia-semestre-drilldown');
    expect(drilldown).toBeInTheDocument();
    // nunca um drawer/dialog — a lista mora dentro do próprio componente.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const nomes = within(drilldown)
      .getAllByRole('button', { name: /^Ver detalhes de/ })
      .map((b) => b.textContent);
    expect(nomes[0]).toContain('Ana'); // 80
    expect(nomes[1]).toContain('Beatriz'); // 60
  });

  it('alunos sem nota de proficiência ficam fora da lista', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={[
          aluno({ id: 'a1', nome: 'Beatriz', semestre: 11, proficiencia: 60 }),
          aluno({ id: 'a2', nome: 'Erik', semestre: 11, proficiencia: null }),
        ]}
        semestreAberto={11}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.queryByText('Erik')).not.toBeInTheDocument();
  });

  it('clicar no nome do aluno chama onSelecionarAluno com o id certo', async () => {
    const user = userEvent.setup();
    const onSelecionarAluno = vi.fn();
    render(
      <ProficienciaPorSemestreChart
        alunos={ALUNOS}
        semestreAberto={11}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={onSelecionarAluno}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Ver detalhes de Ana' }));
    expect(onSelecionarAluno).toHaveBeenCalledWith('a2');
  });

  it('"Voltar" chama onAbrirSemestre com null', async () => {
    const user = userEvent.setup();
    const onAbrirSemestre = vi.fn();
    render(
      <ProficienciaPorSemestreChart
        alunos={ALUNOS}
        semestreAberto={11}
        onAbrirSemestre={onAbrirSemestre}
        onSelecionarAluno={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('proficiencia-semestre-voltar'));
    expect(onAbrirSemestre).toHaveBeenCalledWith(null);
  });

  it('o eixo também aparece no drill-down por aluno', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={ALUNOS}
        semestreAberto={11}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    expect(screen.getByTestId('eixo-meta')).toHaveTextContent('60');
  });

  it('estado vazio quando ninguém do semestre tem nota', () => {
    render(
      <ProficienciaPorSemestreChart
        alunos={[aluno({ id: 'a1', semestre: 11, proficiencia: null })]}
        semestreAberto={11}
        onAbrirSemestre={vi.fn()}
        onSelecionarAluno={vi.fn()}
      />,
    );
    expect(screen.getByTestId('proficiencia-semestre-aluno-vazio')).toHaveTextContent(
      'Nenhum aluno com nota de proficiência neste semestre.',
    );
  });
});
