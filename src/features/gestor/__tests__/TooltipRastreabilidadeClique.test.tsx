import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TooltipRastreabilidade } from '@/features/gestor/components/TooltipRastreabilidade';
import { META_ENGAJAMENTO } from './fixtures/engajamento/visaoGeral';

/** O "i" de rastreabilidade abre também no CLIQUE (o Radix, sozinho, fecha o tooltip no click do gatilho). */

const montar = () =>
  render(
    <TooltipProvider>
      <TooltipRastreabilidade meta={META_ENGAJAMENTO} titulo="Base ativa" />
    </TooltipProvider>,
  );

describe('TooltipRastreabilidade — clique', () => {
  it('clicar no "i" abre o tooltip e ele fica aberto', () => {
    montar();
    const gatilho = screen.getByRole('button', { name: 'Rastreabilidade do indicador' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.pointerDown(gatilho);
    fireEvent.click(gatilho);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Base ativa');
  });

  it('ESC fecha', () => {
    montar();
    const gatilho = screen.getByRole('button', { name: 'Rastreabilidade do indicador' });
    fireEvent.pointerDown(gatilho);
    fireEvent.click(gatilho);
    fireEvent.keyDown(gatilho, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('TooltipRastreabilidade — ocultarFonte', () => {
  const texto = (ocultarFonte: boolean) => {
    render(
      <TooltipProvider>
        <TooltipRastreabilidade meta={META_ENGAJAMENTO} titulo="Base ativa" criterio="Frase curta." ocultarFonte={ocultarFonte} />
      </TooltipProvider>,
    );
    return screen.getByTestId('rastreabilidade-texto').textContent ?? '';
  };

  it('por padrão mostra a fonte', () => {
    expect(texto(false)).toContain('Fonte: ');
  });

  it('com ocultarFonte a fonte some, e período, atualização e o critério informado ficam', () => {
    const t = texto(true);
    expect(t).not.toContain('Fonte');
    expect(t).toContain('Período: ');
    expect(t).toContain('Atualizado em: ');
    expect(t).toContain('Critério: Frase curta.');
  });
});
