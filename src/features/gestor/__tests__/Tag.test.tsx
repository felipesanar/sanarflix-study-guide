import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { Tag, TagCoberturaParcial, TagDelta, TagNivel } from '@/features/gestor/components/Tag';

describe('Tag — as anatomias do handoff §5', () => {
  it('todas as anatomias usam o raio pill e nenhuma sombra', () => {
    for (const variant of ['positivo', 'neutro', 'ausencia', 'qualificador', 'selo', 'contador', 'modalidade'] as const) {
      const { container, unmount } = render(<Tag variant={variant}>x</Tag>);
      const el = container.querySelector('span[style]') as HTMLElement;
      expect(el.style.borderRadius).toBe('var(--gp-radius-pill)');
      expect(el.style.boxShadow).toBe('');
      unmount();
    }
  });

  it('status positivo: 11px, success-on sobre success-surface, sem borda', () => {
    const { container } = render(<Tag variant="positivo">Proficiente</Tag>);
    const el = container.querySelector('span[style]') as HTMLElement;
    expect(el.style.fontSize).toBe('11px');
    expect(el.style.color).toBe('var(--gp-success-on)');
    expect(el.style.background).toBe('var(--gp-success-surface)');
    expect(el.style.border).toBe('');
  });

  it('ausência é a única com borda tracejada — o canal não é só a cor', () => {
    const { container: ausencia } = render(<Tag variant="ausencia">Não participou</Tag>);
    expect((ausencia.querySelector('span[style]') as HTMLElement).style.border).toContain('dashed');

    const { container: neutro } = render(<Tag variant="neutro">Abaixo do limiar</Tag>);
    expect((neutro.querySelector('span[style]') as HTMLElement).style.border).toContain('solid');
  });

  it('qualificador "projetado": 9px/600 uppercase sobre warning-surface', () => {
    const { container } = render(<Tag variant="qualificador">projetado</Tag>);
    const el = container.querySelector('span[style]') as HTMLElement;
    expect(el.style.fontSize).toBe('9px');
    expect(el.style.fontWeight).toBe('600');
    expect(el.style.textTransform).toBe('uppercase');
    expect(el.style.background).toBe('var(--gp-warning-surface)');
  });
});

describe('TagDelta', () => {
  it('positivo leva sinal, seta para cima e cor de sucesso', () => {
    const { container } = render(<TagDelta valor={4} />);
    expect(container.textContent).toContain('+4');
    expect(container.querySelector('i')).toHaveClass('icon-dende-icons-arrow_upward-filled');
    expect((container.querySelector('span[style]') as HTMLElement).style.color).toBe('var(--gp-success-on)');
  });

  it('negativo usa minus tipográfico (U+2212), seta para baixo e cor de erro', () => {
    const { container } = render(<TagDelta valor={-3} />);
    expect(container.textContent).toContain('−3');
    expect(container.textContent).not.toContain('-3');
    expect(container.querySelector('i')).toHaveClass('icon-dende-icons-arrow_downward-filled');
    expect((container.querySelector('span[style]') as HTMLElement).style.color).toBe('var(--gp-danger-on)');
  });

  it('zero é estabilidade medida: tom neutro e sem seta', () => {
    const { container } = render(<TagDelta valor={0} />);
    expect(container.querySelector('i')).toBeNull();
    expect((container.querySelector('span[style]') as HTMLElement).style.color).toBe('var(--gp-text-2)');
  });

  it('o ícone é decorativo — o número já diz tudo ao leitor de tela', () => {
    const { container } = render(<TagDelta valor={4} />);
    expect(container.querySelector('i')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('TagNivel', () => {
  it('a cor é reforço: o rótulo textual está sempre presente', () => {
    render(
      <>
        <TagNivel nivel="excelente" />
        <TagNivel nivel="mediano" />
        <TagNivel nivel="critico" />
      </>,
    );
    expect(screen.getByText('Excelente desempenho')).toBeInTheDocument();
    expect(screen.getByText('Desempenho mediano')).toBeInTheDocument();
    expect(screen.getByText('Desempenho crítico')).toBeInTheDocument();
  });

  it('cada nível tem par on/surface próprio', () => {
    const { container } = render(<TagNivel nivel="critico" />);
    const el = container.querySelector('span[style]') as HTMLElement;
    expect(el.style.color).toBe('var(--gp-danger-on)');
    expect(el.style.background).toBe('var(--gp-danger-surface)');
  });
});

describe('TagCoberturaParcial', () => {
  it('carrega sempre o n da amostra — pílula sem número é aviso vago', () => {
    render(<TagCoberturaParcial n={7} />);
    const tag = screen.getByText('cobertura parcial');
    expect(tag).toHaveAttribute('title', expect.stringContaining('7'));
    expect(tag).toHaveAttribute('aria-label', expect.stringContaining('7'));
  });

  it('concorda em número com o singular', () => {
    render(<TagCoberturaParcial n={1} />);
    expect(screen.getByText('cobertura parcial')).toHaveAttribute(
      'title',
      expect.stringContaining('1 aluno participou'),
    );
  });
});
