import { describe, it, expect } from 'vitest';
import { ADMIN_NAV, filterAdminNav } from '@/experiences/admin/AdminNav';
import { deriveAccessFromRoles } from '@/experiences/access';

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

  it('admin vê todas as seções (tem todas as capabilities)', () => {
    const access = deriveAccessFromRoles(['admin']);
    expect(filterAdminNav(ADMIN_NAV, access)).toHaveLength(ADMIN_NAV.length);
  });

  it('Atendimento (CX) vê apenas Usuários (só tem users.support, não users.manage)', () => {
    const access = deriveAccessFromRoles(['atendimento']);
    const cxNav = filterAdminNav(ADMIN_NAV, access);
    expect(cxNav.map((i) => i.url)).toEqual([]);
  });

  it('cada item declara a sua capability', () => {
    expect(ADMIN_NAV.map((i) => i.capability)).toEqual([
      'users.manage',
      'avisos.manage',
      'ies.manage',
      'guia.manage',
      'sanarclass.manage',
      'simulados.manage',
      'feedbacks.moderate',
      'analytics.view',
    ]);
  });
});
