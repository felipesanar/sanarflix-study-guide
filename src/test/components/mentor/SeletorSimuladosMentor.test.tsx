import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeletorSimuladosMentor } from '@/features/mentor/components/SeletorSimuladosMentor';

const OPCOES = [
  { id: 's1', sequence_number: 1 },
  { id: 's2', sequence_number: 2 },
  { id: 's3', sequence_number: 3 },
];

const pressed = (nome: string) => screen.getByRole('button', { name: nome }).getAttribute('aria-pressed');

describe('SeletorSimuladosMentor', () => {
  describe('modo padrão (Minha turma): vazio = Todos', () => {
    it('mostra "Todos" ativo com seleção vazia e um chip por simulado', () => {
      render(<SeletorSimuladosMentor opcoes={OPCOES} selecionados={[]} onChange={vi.fn()} />);
      expect(pressed('Todos')).toBe('true');
      expect(pressed('Simulado 1')).toBe('false');
      expect(screen.getAllByRole('button')).toHaveLength(4);
    });

    it('alterna chips (multi-seleção) e "Todos" limpa a seleção', () => {
      const onChange = vi.fn();
      const { rerender } = render(<SeletorSimuladosMentor opcoes={OPCOES} selecionados={[]} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Simulado 2' }));
      expect(onChange).toHaveBeenLastCalledWith(['s2']);

      rerender(<SeletorSimuladosMentor opcoes={OPCOES} selecionados={['s2']} onChange={onChange} />);
      expect(pressed('Todos')).toBe('false');
      fireEvent.click(screen.getByRole('button', { name: 'Simulado 3' }));
      expect(onChange).toHaveBeenLastCalledWith(['s2', 's3']);
      fireEvent.click(screen.getByRole('button', { name: 'Simulado 2' }));
      expect(onChange).toHaveBeenLastCalledWith([]);
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
      expect(onChange).toHaveBeenLastCalledWith([]);
    });
  });

  describe('exigirSelecao (Detalhamento): nunca vazio', () => {
    it('não desmarca o último simulado marcado', () => {
      const onChange = vi.fn();
      render(<SeletorSimuladosMentor opcoes={OPCOES} selecionados={['s2']} onChange={onChange} exigirSelecao />);
      fireEvent.click(screen.getByRole('button', { name: 'Simulado 2' }));
      expect(onChange).not.toHaveBeenCalled();
      expect(pressed('Simulado 2')).toBe('true');
    });

    it('permite desmarcar quando há mais de um marcado e marcar outro', () => {
      const onChange = vi.fn();
      render(<SeletorSimuladosMentor opcoes={OPCOES} selecionados={['s1', 's2']} onChange={onChange} exigirSelecao />);
      fireEvent.click(screen.getByRole('button', { name: 'Simulado 1' }));
      expect(onChange).toHaveBeenLastCalledWith(['s2']);
      fireEvent.click(screen.getByRole('button', { name: 'Simulado 3' }));
      expect(onChange).toHaveBeenLastCalledWith(['s1', 's2', 's3']);
    });

    it('"Todos" marca todos os simulados e só fica ativo quando todos estão marcados', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <SeletorSimuladosMentor opcoes={OPCOES} selecionados={['s2']} onChange={onChange} exigirSelecao />,
      );
      expect(pressed('Todos')).toBe('false');
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
      expect(onChange).toHaveBeenLastCalledWith(['s1', 's2', 's3']);

      rerender(
        <SeletorSimuladosMentor opcoes={OPCOES} selecionados={['s1', 's2', 's3']} onChange={onChange} exigirSelecao />,
      );
      expect(pressed('Todos')).toBe('true');
    });
  });
});
