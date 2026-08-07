import { describe, it, expect } from 'vitest';
import { ADMIN_NAV_GROUPS, CX_NAV_GROUPS, filterAdminNav } from '@/experiences/admin/AdminNav';
import { deriveAccessFromRoles } from '@/experiences/access';

const urlsOf = (groups: typeof ADMIN_NAV_GROUPS) => groups.flatMap((g) => g.items.map((i) => i.url));

describe('experiences/admin/AdminNav', () => {
  it('expõe os 4 grupos e as 11 seções do Portal do Admin nas URLs /admin/*', () => {
    expect(ADMIN_NAV_GROUPS.map((g) => g.label)).toEqual([
      'Operação',
      'Contas & acesso',
      'Conteúdo & comunicação',
      'Suporte & dados',
    ]);
    expect(urlsOf(ADMIN_NAV_GROUPS)).toEqual([
      '/admin',
      '/admin/simulados',
      '/admin/monitoramento',
      '/admin/usuarios',
      '/admin/ies',
      '/admin/guia',
      '/admin/avisos',
      '/admin/sanarclass',
      '/admin/feedbacks',
      '/admin/analytics',
      '/admin/auditoria',
    ]);
  });

  it('o Command Center (`/admin`) não exige capability — é a home do admin', () => {
    const commandCenter = ADMIN_NAV_GROUPS[0]?.items[0];
    expect(commandCenter?.url).toBe('/admin');
    expect(commandCenter?.capability).toBeUndefined();
  });

  it('as demais 10 seções declaram capability', () => {
    const items = ADMIN_NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.url !== '/admin');
    expect(items).toHaveLength(10);
    expect(items.every((i) => i.capability != null)).toBe(true);
  });

  it('admin vê todas as 11 seções (tem todas as capabilities)', () => {
    const access = deriveAccessFromRoles(['admin']);
    const filtered = filterAdminNav(ADMIN_NAV_GROUPS, access);
    expect(urlsOf(filtered)).toHaveLength(11);
  });

  it('Atendimento (CX) só enxerga o Command Center em ADMIN_NAV_GROUPS (não tem as capabilities de admin)', () => {
    const access = deriveAccessFromRoles(['atendimento']);
    const filtered = filterAdminNav(ADMIN_NAV_GROUPS, access);
    expect(urlsOf(filtered)).toEqual(['/admin']);
  });

  it('CX_NAV_GROUPS expõe Usuários e Feedbacks (grupo "Atendimento") para quem tem as capabilities de suporte', () => {
    const access = deriveAccessFromRoles(['atendimento']);
    const filtered = filterAdminNav(CX_NAV_GROUPS, access);
    expect(filtered.map((g) => g.label)).toEqual(['Atendimento']);
    expect(urlsOf(filtered)).toEqual(['/atendimento/usuarios', '/atendimento/feedbacks']);
  });

  it('admin puro (sem capabilities de suporte) não vê nada em CX_NAV_GROUPS', () => {
    const access = deriveAccessFromRoles(['admin']);
    // `admin` concede capabilities de admin, não as de suporte (users.support/feedbacks.support).
    expect(filterAdminNav(CX_NAV_GROUPS, access)).toEqual([]);
  });
});
