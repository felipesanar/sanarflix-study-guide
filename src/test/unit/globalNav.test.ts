import { describe, it, expect } from 'vitest';
import { getGlobalNav } from '@/experiences/shared/globalNav';
import { getAccessRules } from '@/utils/accessRules';
import type { User } from '@/types';

const makeUser = (roles: string[]): User => ({
  id: 'u1',
  email: 'u1@example.com',
  nome: 'Usuário',
  id_ies: 'ies-1',
  ies_nome: 'IES 1',
  roles,
});

const urls = (user: User) =>
  getGlobalNav(user, getAccessRules(user)).map((i) => i.url);

describe('experiences/shared/getGlobalNav — nav apartada por experiência', () => {
  it('admin: só links da própria experiência (/admin/*), nenhum de outra', () => {
    const out = urls(makeUser(['admin']));
    expect(out).toEqual(['/admin/usuarios', '/admin/analytics']);
    expect(out.every((u) => u.startsWith('/admin/'))).toBe(true);
  });

  it('gestão: só o Desempenho Institucional (/gestor)', () => {
    expect(urls(makeUser(['gestor']))).toEqual(['/gestor']);
  });

  it('atendimento (CX): só Usuários apontando para /atendimento/usuarios', () => {
    // Regressão: o item "Portal do Admin" apontava para /admin/usuarios, que o
    // CX não monta (só monta /atendimento/*) → NotFound.
    expect(urls(makeUser(['atendimento']))).toEqual(['/atendimento/usuarios']);
  });

  it('aluno: inclui a raiz (/) e nenhum link de admin/gestão/atendimento', () => {
    const aluno = makeUser([]);
    const out = getGlobalNav(aluno, {
      ...getAccessRules(aluno),
      home: true,
    }).map((i) => i.url);
    expect(out).toContain('/');
    expect(
      out.some(
        (u) =>
          u.startsWith('/admin') ||
          u.startsWith('/gestor') ||
          u.startsWith('/atendimento'),
      ),
    ).toBe(false);
  });
});
