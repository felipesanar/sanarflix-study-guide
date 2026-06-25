import { describe, it, expect } from 'vitest';
import { isRouteActive } from '@/experiences/shared/navActive';

describe('experiences/navActive — isRouteActive', () => {
  it('a raiz (/) só fica ativa em correspondência exata', () => {
    expect(isRouteActive('/', '/')).toBe(true);
    expect(isRouteActive('/simulados', '/')).toBe(false);
    expect(isRouteActive('/admin/usuarios', '/')).toBe(false);
  });

  it('correspondência exata ativa o item', () => {
    expect(isRouteActive('/simulados', '/simulados')).toBe(true);
    expect(isRouteActive('/admin/usuarios', '/admin/usuarios')).toBe(true);
    expect(isRouteActive('/gestor', '/gestor')).toBe(true);
  });

  it('descendentes ativam o item (prefixo)', () => {
    expect(isRouteActive('/simulados/123/prova', '/simulados')).toBe(true);
    expect(isRouteActive('/admin/usuarios/42', '/admin/usuarios')).toBe(true);
    expect(isRouteActive('/gestor/ies/1', '/gestor')).toBe(true);
    expect(isRouteActive('/caderno-de-erros/revisao', '/caderno-de-erros')).toBe(
      true,
    );
  });

  it('não ativa por prefixo parcial fora do limite de segmento', () => {
    expect(isRouteActive('/simulados-extra', '/simulados')).toBe(false);
    expect(isRouteActive('/admin/analytics', '/admin/usuarios')).toBe(false);
  });
});
