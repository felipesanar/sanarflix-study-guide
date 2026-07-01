import { describe, it, expect } from 'vitest';
import { filterNavByAccess, type NavItem } from '@/experiences/types';
import { AccessRules } from '@/types';

/** AccessRules com tudo desligado; sobrescreve apenas o que o teste precisa. */
const rules = (overrides: Partial<AccessRules> = {}): AccessRules => ({
  home: false,
  studyGuide: false,
  dashboard: false,
  SimuladoDesempenho: false,
  userManagement: false,
  sanarclass: false,
  simulados: false,
  analytics: false,
  desempenhoInstitucional: false,
  errorNotebook: false,
  ...overrides,
});

/** Cria um NavItem mínimo (ícone como tag intrínseca para evitar React no teste). */
const item = (overrides: Partial<NavItem> & Pick<NavItem, 'title' | 'url'>): NavItem => ({
  icon: 'div',
  ...overrides,
});

describe('experiences/types — filterNavByAccess', () => {
  it('mantém itens sem accessKey (sempre visíveis)', () => {
    const items: NavItem[] = [item({ title: 'Livre', url: '/livre' })];
    expect(filterNavByAccess(items, rules())).toEqual(items);
  });

  it('remove item cujo accessKey está desabilitado', () => {
    const items: NavItem[] = [
      item({ title: 'Simulados', url: '/simulados', accessKey: 'simulados' }),
    ];
    expect(filterNavByAccess(items, rules({ simulados: false }))).toEqual([]);
  });

  it('mantém item cujo accessKey está habilitado', () => {
    const items: NavItem[] = [
      item({ title: 'Simulados', url: '/simulados', accessKey: 'simulados' }),
    ];
    expect(filterNavByAccess(items, rules({ simulados: true }))).toEqual(items);
  });

  it('preserva a ordem ao filtrar uma lista mista', () => {
    const home = item({ title: 'Início', url: '/', accessKey: 'home' });
    const livre = item({ title: 'Livre', url: '/livre' });
    const sims = item({ title: 'Simulados', url: '/simulados', accessKey: 'simulados' });
    const admin = item({ title: 'Admin', url: '/admin/usuarios', accessKey: 'userManagement' });

    const result = filterNavByAccess(
      [home, livre, sims, admin],
      rules({ home: true, simulados: false, userManagement: true }),
    );

    expect(result).toEqual([home, livre, admin]);
  });

  it('lista vazia retorna vazia', () => {
    expect(filterNavByAccess([], rules({ home: true }))).toEqual([]);
  });

  it('não muta a lista de entrada', () => {
    const items: NavItem[] = [
      item({ title: 'Início', url: '/', accessKey: 'home' }),
    ];
    const snapshot = [...items];
    filterNavByAccess(items, rules({ home: false }));
    expect(items).toEqual(snapshot);
  });
});
