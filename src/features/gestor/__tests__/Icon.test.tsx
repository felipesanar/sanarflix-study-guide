import * as React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { Icon } from '@/features/gestor/components/Icon';
import {
  DENDE_ICON_NAMES,
  SOMENTE_FILLED,
  SOMENTE_OUTLINED,
  classeDoIcone,
} from '@/features/gestor/components/icon-names';

const CSS = fs.readFileSync(
  path.resolve(__dirname, '../dende-icons.css'),
  'utf-8',
);

describe('Icon — fonte Fontello do Dendê (handoff §3)', () => {
  it('renderiza a classe do glifo com o tamanho pedido', () => {
    const { container } = render(<Icon name="home" variant="filled" size={18} />);
    const i = container.querySelector('i');
    expect(i).toHaveClass('icon-dende-icons-home-filled');
    expect(i).toHaveStyle({ fontSize: '18px' });
  });

  it('usa outlined como padrão — o repouso é o caso comum, o ativo é a exceção', () => {
    const { container } = render(<Icon name="home" size={18} />);
    expect(container.querySelector('i')).toHaveClass('icon-dende-icons-home-outlined');
  });

  it('é decorativo por padrão e vira role="img" quando recebe label', () => {
    const { container, rerender } = render(<Icon name="close" size={16} />);
    expect(container.querySelector('i')).toHaveAttribute('aria-hidden', 'true');

    rerender(<Icon name="close" size={16} label="Fechar" />);
    expect(screen.getByRole('img', { name: 'Fechar' })).toBeInTheDocument();
  });

  it('com `box`, embrulha numa caixa óptica de largura fixa e centrada', () => {
    const { container } = render(<Icon name="home" size={18} box={20} />);
    const span = container.querySelector('span');
    expect(span).toHaveStyle({ width: '20px', height: '20px' });
    expect(span).toHaveClass('inline-flex', 'items-center', 'justify-center');
    // o glifo interno não pode duplicar a semântica da caixa
    expect(container.querySelector('i')).toHaveAttribute('aria-hidden', 'true');
  });

  it('com `box` e `label`, quem carrega o rótulo é a caixa — um só nó acessível', () => {
    render(<Icon name="notifications" size={18} box={20} label="Notificações" />);
    expect(screen.getAllByRole('img', { name: 'Notificações' })).toHaveLength(1);
  });

  /**
   * O ponto do union fechado: pedir um glifo que a fonte não tem é erro de
   * compilação, não tofu em produção. Este teste guarda o outro lado — todo
   * nome do tipo tem mesmo regra no CSS.
   */
  it('todo nome exportado existe na fonte, em pelo menos uma variante', () => {
    const semGlifo = DENDE_ICON_NAMES.filter((nome) => {
      const filled = CSS.includes(`.icon-dende-icons-${nome}-filled::before`);
      const outlined = CSS.includes(`.icon-dende-icons-${nome}-outlined::before`);
      return !filled && !outlined;
    });
    expect(semGlifo).toEqual([]);
  });

  it('classeDoIcone cai para a variante existente quando o par é incompleto', () => {
    for (const nome of SOMENTE_FILLED) {
      expect(classeDoIcone(nome as never, 'outlined')).toBe(`icon-dende-icons-${nome}-filled`);
    }
    for (const nome of SOMENTE_OUTLINED) {
      expect(classeDoIcone(nome as never, 'filled')).toBe(`icon-dende-icons-${nome}-outlined`);
    }
  });

  it('avisa em desenvolvimento quando a variante pedida não existe', () => {
    const soFilled = [...SOMENTE_FILLED][0];
    if (!soFilled) return;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<Icon name={soFilled as never} variant="outlined" size={16} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(soFilled));
    warn.mockRestore();
  });

  it('a fonte é servida por caminho absoluto e sem o .ttf legado', () => {
    expect(CSS).toContain("url('/fonts/dende/fontello.woff2') format('woff2')");
    expect(CSS).toContain("url('/fonts/dende/fontello.woff') format('woff')");
    // Só o `url(...)`: o cabeçalho do arquivo cita o .ttf ao explicar por que
    // ele não é servido, e uma busca por ".ttf" cru casaria com a explicação.
    expect(CSS).not.toMatch(/url\([^)]*\.ttf/);
  });
});
