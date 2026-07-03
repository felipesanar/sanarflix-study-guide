import { describe, it, expect } from 'vitest';
import { getPortalEntries } from '@/experiences/shared/globalNav';
import type { User } from '@/types';

const makeUser = (roles: string[]): User => ({
  id: 'u1',
  email: 'u1@example.com',
  nome: 'Usuário',
  id_ies: 'ies-1',
  ies_nome: 'IES 1',
  roles,
});

const urls = (user: User) => getPortalEntries(user).map((i) => i.url);

describe('experiences/shared/getPortalEntries — links de portal por role', () => {
  it('admin: link para o Portal do Admin', () => {
    expect(urls(makeUser(['admin']))).toEqual(['/admin/usuarios']);
  });

  it('gestor / gestor_grupo: link para o Desempenho Institucional', () => {
    expect(urls(makeUser(['gestor']))).toEqual(['/gestor']);
    expect(urls(makeUser(['gestor_grupo']))).toEqual(['/gestor']);
  });

  it('atendimento (CX): aponta para /atendimento/usuarios (nunca /admin)', () => {
    const out = urls(makeUser(['atendimento']));
    expect(out).toEqual(['/atendimento/usuarios']);
    expect(out.some((u) => u.startsWith('/admin'))).toBe(false);
  });

  it('aluno/professor: nenhuma entrada de portal', () => {
    expect(urls(makeUser([]))).toEqual([]);
    expect(urls(makeUser(['professor']))).toEqual([]);
  });

  it('múltiplas roles: uma entrada por portal, na ordem admin > gestão > CX', () => {
    expect(urls(makeUser(['atendimento', 'admin', 'gestor']))).toEqual([
      '/admin/usuarios',
      '/gestor',
      '/atendimento/usuarios',
    ]);
  });
});
