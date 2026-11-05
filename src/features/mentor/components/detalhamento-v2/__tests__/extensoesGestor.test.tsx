/**
 * Props opcionais acrescentadas aos componentes do Gestor para o Portal do Mentor. Sem as props, os
 * testes do Gestor (SeletorSimulados, TabelaAlunosSimulado, contraste/movimento da distribuição) cobrem
 * o comportamento de sempre; aqui só o caminho novo.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeletorSimulados } from '@/features/gestor/components/SeletorSimulados';
import { TabelaAlunosSimulado, type ColunaAlunoSimulado, type FaixaAlunoSimulado } from '@/features/gestor/components/TabelaAlunosSimulado';
import { DistribuicaoAlternativas } from '@/features/gestor/charts/DistribuicaoAlternativas';
import type { AlunoNoSimulado, ItemCronograma } from '@/features/gestor/api/types';

const gestor = vi.hoisted(() => ({ ehProva: vi.fn(() => () => false), respondentes: vi.fn(), filtros: vi.fn(() => ({ iesId: null })) }));
vi.mock('@/features/gestor/api/queries', () => ({ useEhProvaOficial: gestor.ehProva, useQuestaoRespondentes: gestor.respondentes }));
vi.mock('@/features/gestor/hooks/useFiltrosGestor', () => ({ useFiltrosGestor: gestor.filtros }));

describe('SeletorSimulados · props do mentor', () => {
  const itens: ItemCronograma[] = [
    { id: 's5', nome: '5º Simulado PRO', data: '2026-09-21', status: 'realizado', modalidade: null, participantes: 62 },
    { id: 's6', nome: '6º Simulado PRO', data: '2026-11-09', status: 'agendado', modalidade: null, participantes: null, indisponivelPorque: 'Ainda não realizado' },
  ];

  it('com `ehProvaOficial` não consulta o recorte do Gestor e usa a nota passada', async () => {
    gestor.ehProva.mockClear();
    gestor.filtros.mockClear();
    const user = userEvent.setup();
    render(<SeletorSimulados itens={itens} selecionados={['s5']} onChange={vi.fn()} ehProvaOficial={() => false} nota="o agregado da turma é a Minha Turma" />);
    expect(gestor.ehProva).not.toHaveBeenCalled();
    expect(gestor.filtros).not.toHaveBeenCalled();
    expect(screen.getByText('o agregado da turma é a Minha Turma')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Escolher simulados' }));
    expect(screen.getByText('Ainda não realizado')).toBeInTheDocument();
    expect(screen.getByText('21/09 · 62 participantes')).toBeInTheDocument();
  });

  it('sem a prop continua no caminho do Gestor (consulta a prova oficial)', () => {
    gestor.ehProva.mockClear();
    render(<SeletorSimulados itens={itens} selecionados={[]} onChange={vi.fn()} />);
    expect(gestor.ehProva).toHaveBeenCalled();
    expect(screen.getByText(/o agregado do período é a Visão Geral/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha ao menos um simulado');
  });
});

describe('TabelaAlunosSimulado · colunas e faixas por prop', () => {
  type Linha = AlunoNoSimulado & { pct: number | null; tipo: 'a' | 'b' | null };
  const linha = (id: string, nome: string, pct: number | null, tipo: Linha['tipo']): Linha =>
    ({ id, nome, semestre: null, participou: pct !== null, acertos: null, proficiencia: null, situacao: pct === null ? 'nao_participou' : 'abaixo_do_limiar', pct, tipo });
  const alunos = [linha('1', 'Ana', 70, 'a'), linha('2', 'Bia', 90, 'a'), linha('3', 'Caio', 50, 'b'), linha('4', 'Duda', null, null)];
  const colunas: ColunaAlunoSimulado<Linha>[] = [
    { id: 'pct', rotulo: '% de acerto', numerica: true, valor: (a) => (a.pct === null ? '—' : `${a.pct}%`), ausente: (a) => a.pct === null, ordenarPor: (a) => a.pct },
    { id: 'tipo', rotulo: 'Situação', valor: (a) => a.tipo ?? '—' },
  ];
  const faixas: FaixaAlunoSimulado<Linha>[] = [
    { chave: 'a', rotulo: 'Faixa A', cor: 'var(--gp-success)', contem: (a) => a.tipo === 'a' },
    { chave: 'b', rotulo: 'Faixa B', cor: 'var(--gp-danger)', contem: (a) => a.tipo === 'b' },
  ];
  const nomes = () => screen.getAllByTestId('celula-nome').map((c) => c.textContent);

  it('troca as colunas, ordena pela inicial, oculta não participantes e filtra pelas faixas', async () => {
    const user = userEvent.setup();
    render(
      <TabelaAlunosSimulado<Linha>
        alunos={alunos} multiSimulado={false} colunas={colunas} faixas={faixas} rotuloFaixas="Filtrar alunos por situação"
        ordenacaoInicial={{ coluna: 'pct', ordem: 'desc' }} ocultarNaoParticipantesInicial
      />,
    );
    expect(screen.queryByRole('columnheader', { name: /Semestre/ })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /% de acerto/ })).toHaveAttribute('aria-sort', 'descending');
    expect(nomes()).toEqual(['Bia', 'Ana', 'Caio']);
    const grupo = screen.getByRole('group', { name: 'Filtrar alunos por situação' });
    // "Todos" conta os participantes.
    expect(within(grupo).getByRole('button', { name: /Todos/ })).toHaveTextContent('3');
    await user.click(within(grupo).getByRole('button', { name: /Faixa B/ }));
    expect(nomes()).toEqual(['Caio']);
    await user.click(screen.getByRole('button', { name: /% de acerto/ }));
    expect(screen.getByRole('columnheader', { name: /% de acerto/ })).toHaveAttribute('aria-sort', 'ascending');
  });
});

describe('DistribuicaoAlternativas · respondentes por prop', () => {
  const alternativas = [
    { letra: 'A' as const, texto: 'Um', correta: false, marcadaPct: 20 },
    { letra: 'C' as const, texto: 'Três', correta: false, marcadaPct: 45 },
    { letra: 'D' as const, texto: 'Quatro', correta: true, marcadaPct: 35 },
  ];

  it('abre a linha inicial, limita os nomes, mostra as ações e não chama o hook do Gestor', async () => {
    gestor.respondentes.mockClear();
    const abrir = vi.fn();
    const user = userEvent.setup();
    render(
      <DistribuicaoAlternativas
        alternativas={alternativas}
        abertaInicial="C"
        limiteRespondentes={2}
        respondentes={{ C: { total: 27, alunos: [{ alunoId: 'a@x', nome: 'ANA' }, { alunoId: 'b@x', nome: 'BIA' }, { alunoId: 'c@x', nome: 'CAIO' }] } }}
        acoesRespondentes={(letra, lista) => <button type="button">Mensagem pra quem marcou {letra} ({lista.total})</button>}
        onAbrirAluno={abrir}
      />,
    );
    const bloco = screen.getByTestId('respondentes-C');
    expect(within(bloco).getByText('Quem marcou C')).toBeInTheDocument();
    expect(within(bloco).getByText('27 alunos · mostrando 2')).toBeInTheDocument();
    expect(within(bloco).queryByText('CAIO')).not.toBeInTheDocument();
    expect(within(bloco).getByRole('button', { name: 'Mensagem pra quem marcou C (27)' })).toBeInTheDocument();
    await user.click(within(bloco).getByRole('button', { name: 'BIA' }));
    expect(abrir).toHaveBeenCalledWith('b@x', 'BIA');
    expect(gestor.respondentes).not.toHaveBeenCalled();
    // Letra sem lista: aviso, nunca uma lista inventada.
    await user.click(screen.getByTestId('distribuicao-A'));
    expect(screen.getByTestId('respondentes-A')).toHaveTextContent('Lista de alunos indisponível para esta alternativa.');
  });
});
