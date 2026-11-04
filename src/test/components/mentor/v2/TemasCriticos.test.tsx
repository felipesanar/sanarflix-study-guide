import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { TemasCriticos, type TemasCriticosProps } from '@/features/mentor/components/TemasCriticos';
import type { TemaTurma } from '@/features/mentor/api/types';

const temas: TemaTurma[] = Array.from({ length: 12 }, (_, i) => ({ id: String(i), tema: `Tema ${i}`, especialidade: 'Clínica', grandeArea: i < 8 ? 'Clínica Médica' : 'Pediatria', prevalencia: 'alta', acertoPct: 30 + i, respostas: 30, alunosAbaixo50: 12, serie: [{ rotulo: '1º', valor: null }, { rotulo: '2º', valor: 30 }] }));
const props: TemasCriticosProps = { modalidade: 'b2b', temas, estado: 'ok', areas: ['Clínica Médica', 'Pediatria'], onCriarIntervencao: vi.fn() };

it('expande de 5 em 5 até o fim e recolhe fechando a linha', () => {
  render(<TemasCriticos {...props} />);
  expect(screen.getByText('Mostrando 5 de 12')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais 5 (faltam 7)' }));
  expect(screen.getByText('Mostrando 10 de 12')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais 2' }));
  expect(screen.getByText('Mostrando 12 de 12')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Expandir Tema 0/ }));
  expect(screen.getByText('Evolução no tema')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Recolher para os 5 primeiros' }));
  expect(screen.getByText('Mostrando 5 de 12')).toBeVisible();
  expect(screen.queryByText('Evolução no tema')).not.toBeInTheDocument();
});

it('filtro e ordenação voltam para cinco e lista curta não expande', () => {
  render(<TemasCriticos {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /Mostrar mais/ }));
  fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'acerto' } });
  expect(screen.getByText('Mostrando 5 de 12')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Mostrar mais/ }));
  fireEvent.change(screen.getByLabelText('Grande área'), { target: { value: 'Clínica Médica' } });
  expect(screen.getByText('Mostrando 5 de 8')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Grande área'), { target: { value: 'Pediatria' } });
  expect(screen.getByText('Mostrando 4 de 4')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Mostrar mais|Recolher/ })).not.toBeInTheDocument();
});

it('ações recebem o tema; tema na pauta desabilita a ação', () => {
  const oficina = vi.fn();
  const { rerender } = render(<TemasCriticos {...props} onLevarParaOficina={oficina} proximaOficinaRotulo="19/11" />);
  fireEvent.click(screen.getByRole('button', { name: /Expandir Tema 0/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Criar intervenção' }));
  expect(props.onCriarIntervencao).toHaveBeenCalledWith(temas[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Levar para a próxima oficina (19/11)' }));
  expect(oficina).toHaveBeenCalledWith(temas[0]);
  rerender(<TemasCriticos {...props} onLevarParaOficina={oficina} naPauta={new Set(['0'])} />);
  expect(screen.getByRole('button', { name: 'Na pauta da oficina' })).toBeDisabled();
});

it('vazio/undefined não gera contagem fictícia nem tabela vazia', () => {
  render(<TemasCriticos {...props} temas={undefined} />);
  expect(screen.getByText('Nenhum tema abaixo de 50% de acerto.')).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('B2C com null mostra — e evolução sem dois pontos não sugere tendência', () => {
  render(<TemasCriticos {...props} modalidade="b2c" temas={[{ ...temas[0], acertoPct: null }]} />);
  expect(within(screen.getByRole('table')).getByText('—')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Expandir Tema 0/ }));
  expect(screen.getByText('Só 1 simulado no recorte.')).toBeVisible();
});

it('mantém semântica de tabela e botão, com expansão acessível', async () => {
  const { container } = render(<TemasCriticos {...props} temas={temas.slice(0, 1)} />);
  fireEvent.click(screen.getByRole('button', { name: /Expandir Tema 0/ }));
  expect(screen.getByRole('button', { name: /Recolher Tema 0/ })).toHaveAttribute('aria-expanded', 'true');
  // Contraste requer CSS e renderização reais; jsdom não implementa canvas.
  expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
});
