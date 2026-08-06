import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Glossario, ENTRADAS_GLOSSARIO } from '../components/Glossario';

describe('Glossario', () => {
  it('lista as 5 entradas de escala', () => {
    expect(ENTRADAS_GLOSSARIO.map((e) => e.termo)).toEqual([
      'Proficiência (0 a 100)',
      'Conceito ENAMED projetado (1 a 5)',
      'Percentual de acerto',
      'Cobertura parcial',
      'Proficiente',
    ]);
  });

  it('NÃO contém a métrica "Nota TRI" (spec §4.1)', () => {
    const texto = JSON.stringify(ENTRADAS_GLOSSARIO);
    expect(texto).not.toMatch(/Nota TRI/i);
    expect(texto).not.toMatch(/\bTRI\b/);
  });

  it('define proficiente com o corte de 60 inclusivo', () => {
    const proficiente = ENTRADAS_GLOSSARIO.find((e) => e.termo === 'Proficiente');
    expect(proficiente?.definicao).toContain('60 ou mais');
  });

  it('abre pelo link e mostra as definições', async () => {
    const user = userEvent.setup();
    render(<Glossario />);

    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Entenda as métricas' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // "Entenda as métricas" também é o rótulo do gatilho; escopa ao diálogo.
    expect(within(dialog).getByText('Entenda as métricas')).toBeInTheDocument();
    for (const entrada of ENTRADAS_GLOSSARIO) {
      expect(screen.getByText(entrada.termo)).toBeInTheDocument();
    }
  });

  /**
   * O diálogo é do PORTAL: nenhum glifo de outra família (handoff §3, 100%
   * Fontello do Dendê), nada em inglês (docs/11-acessibilidade.md) e o scrim
   * pelo token de tema. Sem as props de slot, o `DialogContent` entrega o `X`
   * do Lucide anunciando "Close" sobre um `bg-black/80` que ignora o tema.
   */
  it('o fechar é do Dendê, anuncia "Fechar" e o scrim usa o token do portal', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<Glossario />);

    await user.click(screen.getByRole('button', { name: 'Entenda as métricas' }));

    const fechar = screen.getByRole('button', { name: 'Fechar' });
    expect(fechar.querySelector('.icon-dende-icons-close-outlined')).not.toBeNull();
    expect(fechar.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(fechar.className).toContain('h-[30px]');
    expect(fechar.className).toContain('rounded-[8px]');

    const scrim = baseElement.querySelector('div.fixed.inset-0');
    expect(scrim?.className).toContain('bg-[var(--gp-scrim)]');
    expect(scrim?.className).not.toContain('bg-black/80');
  });

  it('fecha com ESC', async () => {
    const user = userEvent.setup();
    render(<Glossario />);

    await user.click(screen.getByRole('button', { name: 'Entenda as métricas' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
