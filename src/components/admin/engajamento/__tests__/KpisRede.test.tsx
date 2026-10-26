import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import { KpisRede } from '@/components/admin/engajamento/KpisRede';
import { compacto } from '@/features/gestor/lib/engajamento';
import { adminEngajamento, adminEngajamentoSemestre8 } from '@/features/gestor/__tests__/fixtures/engajamento/admin';

/** KPIs da rede no console admin (spec 2026-10-22-engajamento §12.5). */

const cartoes = () =>
  [...screen.getByTestId('kpis-rede').children].map((c) => ({
    texto: c.textContent,
  }));

describe('KpisRede', () => {
  it('sem semestre: base da rede, engajados com a mediana por IES, sem retorno e questões', () => {
    render(<KpisRede rede={adminEngajamento().rede} semestre={null} />);
    expect(cartoes().map((c) => c.texto)).toEqual([
      'Base ativa da rede1.0003 IES',
      'Engajados60%mediana por IES: 63%',
      'Sem retorno há 30+ dias25025% da base',
      'Questões resolvidas261 milacerto médio 66%',
    ]);
  });

  it('com semestre: rótulo da base com o semestre, "rede inteira" e "da base do semestre"', () => {
    render(<KpisRede rede={adminEngajamentoSemestre8().rede} semestre={8} />);
    expect(cartoes().map((c) => c.texto)).toEqual([
      'Base ativa · 8º semestre1703 IES',
      'Engajados65%rede inteira: 60%',
      'Sem retorno há 30+ dias2817% da base do semestre',
      'Questões resolvidas20.477acerto médio 67%',
    ]);
  });

  it('questões em notação compacta: 261000 → "261 mil"', () => {
    expect(compacto(261000)).toBe('261 mil');
    render(<KpisRede rede={adminEngajamento().rede} semestre={null} />);
    expect(screen.getByText('261 mil')).toBeInTheDocument();
  });

  it('valores ausentes viram "—", nunca zero inventado', () => {
    const rede = { ...adminEngajamento().rede, engajadosPct: null, medianaEngajadosPctIes: null, acertoPct: null, semRetorno30Pct: null };
    render(<KpisRede rede={rede} semestre={null} />);
    const t = cartoes().map((c) => c.texto);
    expect(t[1]).toBe('Engajados—mediana por IES: —');
    expect(t[2]).toContain('— da base');
    expect(t[3]).toContain('acerto médio —');
  });

  it('sem o filtro de semestre, a nota nunca cita a rede inteira', () => {
    render(<KpisRede rede={adminEngajamento().rede} semestre={null} />);
    expect(screen.queryByText(/rede inteira/)).not.toBeInTheDocument();
  });

  it('usa as classes do tema geral do console, sem tokens do portal do gestor nem cor literal', () => {
    const { container } = render(<KpisRede rede={adminEngajamento().rede} semestre={null} />);
    expect(container.innerHTML).not.toContain('--gp-');
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
    expect(within(screen.getByTestId('kpis-rede')).getAllByText(/./).length).toBeGreaterThan(0);
  });
});
