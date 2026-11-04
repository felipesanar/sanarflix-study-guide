import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ListaPrioridades, type ListaPrioridadesProps } from '@/features/mentor/components/ListaPrioridades';

const props: ListaPrioridadesProps<string> = {
  titulo: 'Quem precisa de você', resumo: '1 alerta', estado: 'ok',
  itens: [{ chave: 'sumiram', titulo: 'Sumiram', criterio: 'Sem acesso há 15 dias ou mais', prioridade: 'alta', alunoIds: ['a', 'b'] }, { chave: 'vazio', titulo: 'Vazio', criterio: '', prioridade: 'media', alunoIds: [] }],
  icone: () => ({ nome: 'groups', cor: 'var(--gp-danger)' }), iniciais: () => ['AA', 'BB', 'CC', 'DD'], onSelecionar: vi.fn(),
};

it('oculta grupo vazio, limita avatares e chama filtro', () => {
  render(<ListaPrioridades {...props} />);
  expect(screen.queryByText('Vazio')).not.toBeInTheDocument();
  expect(screen.queryByText('DD')).not.toBeInTheDocument();
  expect(screen.getByText('AA').parentElement).toHaveClass('hidden', 'min-[600px]:flex');
  expect(screen.getByText('Alta').style.borderRadius).not.toBe('5px');
  fireEvent.click(screen.getByRole('button', { name: /Sumiram/ }));
  expect(props.onSelecionar).toHaveBeenCalledWith('sumiram');
});

it('sem prioridades mostra vazio reutilizado, não um zero fictício', () => {
  render(<ListaPrioridades {...props} itens={[]} />);
  expect(screen.getByText('Sem dados neste recorte.')).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('múltiplas listas não repetem o id do título', () => {
  render(<><ListaPrioridades {...props} /><ListaPrioridades {...props} titulo="Prioridades de acompanhamento" /></>);
  const headings = screen.getAllByRole('heading');
  expect(headings[0].id).not.toBe(headings[1].id);
});
