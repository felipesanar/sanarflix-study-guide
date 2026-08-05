import { describe, it, expect } from 'vitest';
import { mediaPonderadaPorParticipantes, mediana } from '@/features/gestor/lib/agregarDetalhamento';

describe('mediaPonderadaPorParticipantes', () => {
  it('pondera pelo número de participantes de cada simulado', () => {
    const valor = mediaPonderadaPorParticipantes([
      { valor: 60, participantes: 100 },
      { valor: 70, participantes: 50 },
    ]);
    expect(valor).toBeCloseTo(63.3333, 3);
  });

  it('devolve o próprio valor com uma única entrada', () => {
    expect(mediaPonderadaPorParticipantes([{ valor: 72.5, participantes: 40 }])).toBe(72.5);
  });

  it('ignora entradas com valor null em vez de tratá-las como zero (§4.10)', () => {
    expect(
      mediaPonderadaPorParticipantes([
        { valor: null, participantes: 100 },
        { valor: 80, participantes: 20 },
      ]),
    ).toBe(80);
  });

  it('ignora entradas sem participante', () => {
    expect(
      mediaPonderadaPorParticipantes([
        { valor: 10, participantes: 0 },
        { valor: 90, participantes: 10 },
      ]),
    ).toBe(90);
  });

  it('devolve null quando não há nenhuma entrada aproveitável', () => {
    expect(mediaPonderadaPorParticipantes([])).toBeNull();
    expect(mediaPonderadaPorParticipantes([{ valor: null, participantes: 30 }])).toBeNull();
    expect(mediaPonderadaPorParticipantes([{ valor: 50, participantes: 0 }])).toBeNull();
  });
});

describe('mediana', () => {
  it('devolve o valor central numa lista ímpar', () => {
    expect(mediana([70, 30, 50])).toBe(50);
  });

  it('devolve a média dos dois centrais numa lista par', () => {
    expect(mediana([10, 20, 30, 40])).toBe(25);
  });

  it('devolve null para lista vazia', () => {
    expect(mediana([])).toBeNull();
  });
});
