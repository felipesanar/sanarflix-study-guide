import { describe, it, expect } from 'vitest';
import { GESTOR_NAV, filterGestorNav } from '@/experiences/gestor/GestorNav';
import { deriveAccessFromRoles } from '@/experiences/access';

describe('experiences/gestor/GestorNav', () => {
  it('expõe os 7 itens do console de Gestão nas URLs /gestor/*', () => {
    expect(GESTOR_NAV.map((i) => i.path)).toEqual([
      '/gestor/panorama',
      '/gestor/diagnostico-curricular',
      '/gestor/alunos-risco',
      '/gestor/intervencao-impacto',
      '/gestor/simulados-questoes',
      '/gestor/comparar-ies',
      '/gestor/relatorios',
    ]);
  });

  it('marca "Simulados & questões" com o badge "novo"', () => {
    const item = GESTOR_NAV.find((i) => i.path === '/gestor/simulados-questoes');
    expect(item?.badge).toBe('novo');
  });

  it('marca "Comparar IES" como groupOnly (só multi-IES)', () => {
    const item = GESTOR_NAV.find((i) => i.path === '/gestor/comparar-ies');
    expect(item?.groupOnly).toBe(true);
  });

  it('gestor (institutional.view + alunos.view) com 1 única IES não vê Comparar IES', () => {
    const access = deriveAccessFromRoles(['gestor']);
    const visible = filterGestorNav(GESTOR_NAV, access, 1);
    expect(visible.map((i) => i.path)).not.toContain('/gestor/comparar-ies');
    expect(visible).toHaveLength(GESTOR_NAV.length - 1);
  });

  it('gestor de grupo com multi-IES vê todos os 7 itens, incluindo Comparar IES', () => {
    const access = deriveAccessFromRoles(['gestor_grupo']);
    const visible = filterGestorNav(GESTOR_NAV, access, 3);
    expect(visible).toHaveLength(GESTOR_NAV.length);
  });

  it('admin (super usuário) com multi-IES também vê todos os itens', () => {
    const access = deriveAccessFromRoles(['admin']);
    expect(filterGestorNav(GESTOR_NAV, access, 2)).toHaveLength(GESTOR_NAV.length);
  });
});
