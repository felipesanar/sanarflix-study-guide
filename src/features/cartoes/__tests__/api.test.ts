import { describe, expect, it } from 'vitest';
import { ehEquipe, listarAlunosDaIes } from '../api.ts';

/** Cliente de mentira com as duas consultas que a tela faz: `users` (paginada) e `user_roles` (em lotes). */
function clienteFalso(users: Array<Record<string, unknown>>, roles: Array<{ user_id: string; role: string }>) {
  const chamadas = { paginas: 0, lotes: 0 };
  const client = {
    from(tabela: string) {
      if (tabela === 'users') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => ({
                  range: (de: number, ate: number) => {
                    chamadas.paginas++;
                    return Promise.resolve({ data: users.slice(de, ate + 1), error: null });
                  },
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: (_col: string, ids: string[]) => {
            chamadas.lotes++;
            return Promise.resolve({ data: roles.filter((r) => ids.includes(r.user_id)), error: null });
          },
        }),
      };
    },
  };
  return { client: client as never, chamadas };
}

const user = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `u-${n}`,
  nome: `Usuário ${n}`,
  matricula_ra: `M${n}`,
  email: `u${n}@x.com`,
  semestre: n % 2 ? 7 : null,
  ...extra,
});

describe('listarAlunosDaIes', () => {
  it('devolve TODOS os usuários da IES: a equipe vem com os papéis, e ninguém some por falta de semestre', async () => {
    const users = [user(1), user(2), user(3, { semestre: null, matricula_ra: null }), user(4)];
    const { client } = clienteFalso(users, [
      { user_id: 'u-2', role: 'professor' },
      { user_id: 'u-3', role: 'professor' },
      { user_id: 'u-3', role: 'gestor' },
    ]);
    const r = await listarAlunosDaIes(client, 'ies-1');
    expect(r).toHaveLength(users.length);
    expect(r.map((a) => a.papeis)).toEqual([[], ['professor'], ['gestor', 'professor'], []]);
    expect(r.filter((a) => a.semestre === null)).toHaveLength(3); // aparecem
    expect(r.filter(ehEquipe).map((a) => a.nome)).toEqual(['Usuário 2', 'Usuário 3']);
    expect(r[2]).toMatchObject({ matricula: null, email: 'u3@x.com', semestre: null });
  });

  it('o total bate com o da IES também com mais de uma página e mais de um lote de papéis', async () => {
    const users = Array.from({ length: 2300 }, (_, i) => user(i + 1));
    const roles = users.filter((_, i) => i % 7 === 0).map((u) => ({ user_id: u.id, role: 'professor' }));
    const { client, chamadas } = clienteFalso(users, roles);
    const r = await listarAlunosDaIes(client, 'ies-1');
    expect(r).toHaveLength(2300);
    expect(new Set(r.map((a) => a.userId)).size).toBe(2300);
    expect(chamadas.paginas).toBe(3); // 1.000 por página
    expect(chamadas.lotes).toBe(Math.ceil(2300 / 150));
    expect(r.filter(ehEquipe)).toHaveLength(roles.length);
  });

  it('normaliza matrícula e e-mail vazios para null', async () => {
    const { client } = clienteFalso([user(1, { matricula_ra: '  ', email: '' })], []);
    const [a] = await listarAlunosDaIes(client, 'ies-1');
    expect(a).toMatchObject({ matricula: null, email: null, papeis: [] });
  });

  it('ehEquipe tolera objetos sem papéis', () => {
    expect(ehEquipe({})).toBe(false);
    expect(ehEquipe({ papeis: [] })).toBe(false);
    expect(ehEquipe({ papeis: ['professor'] })).toBe(true);
  });
});
