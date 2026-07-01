import { describe, it, expect } from 'vitest';
import { ADMIN_NAV, filterAdminNav } from '@/experiences/admin/AdminNav';

describe('experiences/admin/AdminNav', () => {
  it('expõe as 8 seções do Portal do Admin nas novas URLs /admin/*', () => {
    expect(ADMIN_NAV.map((i) => i.url)).toEqual([
      '/admin/usuarios',
      '/admin/avisos',
      '/admin/ies',
      '/admin/guia',
      '/admin/sanarclass',
      '/admin/simulados',
      '/admin/feedbacks',
      '/admin/analytics',
    ]);
  });

  it('admin vê todas as seções', () => {
    expect(filterAdminNav(ADMIN_NAV, { isAdmin: true })).toHaveLength(
      ADMIN_NAV.length,
    );
  });

  it('Atendimento (CX) vê apenas Usuários', () => {
    const cxNav = filterAdminNav(ADMIN_NAV, { isAdmin: false });
    expect(cxNav.map((i) => i.url)).toEqual(['/admin/usuarios']);
  });
});
