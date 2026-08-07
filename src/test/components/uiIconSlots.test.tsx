import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Icon } from '@/features/gestor/components/Icon';

/**
 * `select.tsx`, `sheet.tsx` e `dialog.tsx` são compartilhados por aluno, admin e
 * pelo Portal do Gestor v2. O gestor exige 100% dos glifos vindos do Fontello do
 * Dendê (handoff §3); aluno e admin seguem no Lucide. A saída foi o mesmo
 * precedente da prop `container` (Task 65): slot OPCIONAL de ícone, com o
 * default igual ao comportamento de hoje.
 *
 * Este arquivo trava as DUAS pontas do contrato — o que quebra se alguém
 * "limpar" o Lucide dessas primitivas achando que ninguém mais depende dele:
 * (a) sem a prop, o glifo Lucide continua exatamente onde estava;
 * (b) com a prop, entra o glifo do Dendê e o Lucide some.
 */

const seletorDende = 'i[class*="icon-dende-icons-"]';

describe('Primitivas compartilhadas · slot de ícone (select)', () => {
  beforeAll(() => {
    // Radix Select depende de scrollIntoView/hasPointerCapture, ausentes no jsdom.
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
  });

  const abrirSelect = (props: {
    icon?: React.ReactNode;
    indicatorIcon?: React.ReactNode;
  } = {}) => {
    const { container } = render(
      <Select defaultValue="ies-1">
        <SelectTrigger aria-label="Instituição" icon={props.icon}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ies-1" indicatorIcon={props.indicatorIcon}>
            IES Alfa
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    return container;
  };

  it('sem a prop, o gatilho mantém o chevron do Lucide (aluno e admin não mudam)', () => {
    const container = abrirSelect();
    const gatilho = screen.getByRole('combobox', { name: 'Instituição' });

    expect(gatilho.querySelector('svg')).not.toBeNull();
    expect(container.querySelector(seletorDende)).toBeNull();
  });

  it('com `icon`, o gatilho troca para o glifo do Dendê e o SVG do Lucide some', () => {
    abrirSelect({ icon: <Icon name="expand_more" size={16} /> });
    const gatilho = screen.getByRole('combobox', { name: 'Instituição' });

    expect(gatilho.querySelector('.icon-dende-icons-expand_more-outlined')).not.toBeNull();
    expect(gatilho.querySelector('svg')).toBeNull();
  });

  it('`indicatorIcon` troca a marca de item selecionado; sem ele, segue o Check do Lucide', () => {
    const { unmount } = render(
      <Select defaultValue="ies-1">
        <SelectTrigger aria-label="Padrão">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ies-1">IES Alfa</SelectItem>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Padrão' }));
    const itemPadrao = screen.getByRole('option', { name: 'IES Alfa' });
    expect(itemPadrao.querySelector('svg')).not.toBeNull();
    expect(itemPadrao.querySelector(seletorDende)).toBeNull();
    unmount();

    render(
      <Select defaultValue="ies-1">
        <SelectTrigger aria-label="Dendê">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ies-1" indicatorIcon={<Icon name="check" size={11} />}>
            IES Alfa
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Dendê' }));
    const itemDende = screen.getByRole('option', { name: 'IES Alfa' });
    expect(itemDende.querySelector('.icon-dende-icons-check-outlined')).not.toBeNull();
    expect(itemDende.querySelector('svg')).toBeNull();
  });
});

describe('Primitivas compartilhadas · slot de ícone (sheet)', () => {
  it('sem props, o fechar segue igual ao de hoje: X do Lucide e rótulo "Close"', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Aluno</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    const fechar = screen.getByRole('button', { name: 'Close' });

    expect(fechar.querySelector('svg')).not.toBeNull();
    expect(fechar.querySelector(seletorDende)).toBeNull();
  });

  it('com as props, o fechar vira alvo 30×30 com glifo do Dendê e rótulo em pt-BR', () => {
    render(
      <Sheet open>
        <SheetContent
          closeIcon={<Icon name="close" size={16} />}
          closeLabel="Fechar"
          closeClassName="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] opacity-100"
        >
          <SheetTitle>Aluno</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    const fechar = screen.getByRole('button', { name: 'Fechar' });

    expect(fechar.querySelector('.icon-dende-icons-close-outlined')).not.toBeNull();
    expect(fechar.querySelector('svg')).toBeNull();
    expect(fechar.className).toContain('h-[30px]');
    expect(fechar.className).toContain('rounded-[8px]');
    // O `opacity-100` do gestor precisa VENCER o `opacity-70` do shadcn:
    // se o tailwind-merge não resolvesse, o alvo ficaria translúcido.
    expect(fechar.className).toContain('opacity-100');
    expect(fechar.className).not.toContain('opacity-70');
    expect(screen.queryByText('Close')).toBeNull();
  });

  it('`overlayClassName` substitui o scrim padrão sem deixar `bg-black/80` para trás', () => {
    const { baseElement } = render(
      <Sheet open>
        <SheetContent overlayClassName="bg-[var(--gp-scrim)]">
          <SheetTitle>Aluno</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    const scrim = baseElement.querySelector('.bg-\\[var\\(--gp-scrim\\)\\]');

    expect(scrim).not.toBeNull();
    expect(baseElement.querySelector('.bg-black\\/80')).toBeNull();
  });
});

describe('Primitivas compartilhadas · slot de ícone (dialog)', () => {
  it('sem props, o fechar segue igual ao de hoje: X do Lucide e rótulo "Close"', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Entenda as métricas</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const fechar = screen.getByRole('button', { name: 'Close' });

    expect(fechar.querySelector('svg')).not.toBeNull();
    expect(fechar.querySelector(seletorDende)).toBeNull();
  });

  it('com as props, o fechar do Glossário usa o glifo do Dendê e anuncia "Fechar"', () => {
    render(
      <Dialog open>
        <DialogContent
          closeIcon={<Icon name="close" size={16} />}
          closeLabel="Fechar"
          closeClassName="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] opacity-100"
        >
          <DialogTitle>Entenda as métricas</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const fechar = screen.getByRole('button', { name: 'Fechar' });

    expect(fechar.querySelector('.icon-dende-icons-close-outlined')).not.toBeNull();
    expect(fechar.querySelector('svg')).toBeNull();
    expect(fechar.className).toContain('h-[30px]');
  });
});
