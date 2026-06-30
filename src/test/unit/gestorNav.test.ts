import { describe, it, expect } from 'vitest';
import { GESTOR_NAV, tabForPath } from '@/experiences/gestor/GestorNav';

describe('experiences/gestor/GestorNav', () => {
  it('expõe os 5 módulos do gestor nas URLs /gestor/*', () => {
    expect(GESTOR_NAV.map((i) => i.url)).toEqual([
      '/gestor/visao-institucional',
      '/gestor/diagnostico-curricular',
      '/gestor/alunos',
      '/gestor/insights-pedagogicos',
      '/gestor/inteligencia-decisoria',
    ]);
  });

  it('mapeia cada URL ao seu módulo (tab) do Desempenho Institucional', () => {
    expect(tabForPath('/gestor/visao-institucional')).toBe('visao-institucional');
    expect(tabForPath('/gestor/diagnostico-curricular')).toBe('diagnostico-curricular');
    // /gestor/alunos casa com o módulo visao-alunos.
    expect(tabForPath('/gestor/alunos')).toBe('visao-alunos');
    expect(tabForPath('/gestor/insights-pedagogicos')).toBe('insights-pedagogicos');
    expect(tabForPath('/gestor/inteligencia-decisoria')).toBe('inteligencia-decisoria');
  });

  it('faz fallback para visão institucional em rota desconhecida', () => {
    expect(tabForPath('/gestor')).toBe('visao-institucional');
    expect(tabForPath('/gestor/qualquer-coisa')).toBe('visao-institucional');
  });
});
