import { describe, it, expect } from 'vitest';
import {
  agregarProficienciaPorSemestre,
  mediaPonderadaPorParticipantes,
  mediana,
} from '@/features/gestor/lib/agregarDetalhamento';
import type { AlunoNoSimulado } from '@/features/gestor/api/types';

/** Aluno mínimo para os testes de `agregarProficienciaPorSemestre` — só os campos que a função lê. */
function aluno(overrides: Partial<AlunoNoSimulado>): AlunoNoSimulado {
  return {
    id: overrides.id ?? 'aluno-1',
    nome: overrides.nome ?? 'Fulano',
    semestre: overrides.semestre ?? null,
    participou: overrides.participou ?? true,
    acertos: overrides.acertos ?? null,
    proficiencia: overrides.proficiencia ?? null,
    situacao: overrides.situacao ?? 'proficiente',
    ...overrides,
  };
}

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

describe('agregarProficienciaPorSemestre', () => {
  it('agrega e tira a média por semestre', () => {
    const resultado = agregarProficienciaPorSemestre([
      aluno({ id: 'a1', semestre: 11, proficiencia: 60 }),
      aluno({ id: 'a2', semestre: 11, proficiencia: 80 }),
      aluno({ id: 'a3', semestre: 12, proficiencia: 90 }),
    ]);
    expect(resultado).toEqual([
      { semestre: 12, mediaProficiencia: 90, amostra: 1 },
      { semestre: 11, mediaProficiencia: 70, amostra: 2 },
    ]);
  });

  it('ignora alunos com proficiencia null na média, sem descartar o semestre (§4.10)', () => {
    const resultado = agregarProficienciaPorSemestre([
      aluno({ id: 'a1', semestre: 11, proficiencia: 80 }),
      aluno({ id: 'a2', semestre: 11, proficiencia: null }),
    ]);
    expect(resultado).toEqual([{ semestre: 11, mediaProficiencia: 80, amostra: 1 }]);
  });

  it('ignora alunos com semestre null', () => {
    const resultado = agregarProficienciaPorSemestre([
      aluno({ id: 'a1', semestre: null, proficiencia: 80 }),
      aluno({ id: 'a2', semestre: 11, proficiencia: 60 }),
    ]);
    expect(resultado).toEqual([{ semestre: 11, mediaProficiencia: 60, amostra: 1 }]);
  });

  it('semestre sem nenhum aluno com nota não aparece no resultado', () => {
    const resultado = agregarProficienciaPorSemestre([aluno({ id: 'a1', semestre: 11, proficiencia: null })]);
    expect(resultado).toEqual([]);
  });

  it('ordena por semestre decrescente', () => {
    const resultado = agregarProficienciaPorSemestre([
      aluno({ id: 'a1', semestre: 1, proficiencia: 50 }),
      aluno({ id: 'a2', semestre: 12, proficiencia: 90 }),
      aluno({ id: 'a3', semestre: 8, proficiencia: 70 }),
    ]);
    expect(resultado.map((r) => r.semestre)).toEqual([12, 8, 1]);
  });

  it('lista vazia devolve array vazio', () => {
    expect(agregarProficienciaPorSemestre([])).toEqual([]);
  });
});
