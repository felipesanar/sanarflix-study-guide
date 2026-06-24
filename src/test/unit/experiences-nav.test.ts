import { describe, it, expect } from 'vitest';
import { filterNavByAccess, type NavItem } from '@/experiences/types';
import type { AccessRules } from '@/types';

const items: NavItem[] = [
  { title: 'Usuários', url: '/admin/usuarios', accessKey: 'userManagement' },
  { title: 'Analytics', url: '/admin/analytics', accessKey: 'analytics' },
];

describe('filterNavByAccess', () => {
  it('mantém apenas itens liberados pelo accessRules', () => {
    const rules = { userManagement: true, analytics: false } as AccessRules;
    const result = filterNavByAccess(items, rules);
    expect(result.map((i) => i.url)).toEqual(['/admin/usuarios']);
  });

  it('item sem accessKey é sempre mantido', () => {
    const result = filterNavByAccess([{ title: 'X', url: '/x' }], {} as AccessRules);
    expect(result).toHaveLength(1);
  });
});
