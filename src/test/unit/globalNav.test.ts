import { describe, it, expect } from 'vitest';
import { getPortalEntries } from '@/experiences/shared/globalNav';
import { deriveAccessFromRoles } from '@/experiences/access';

const urls = (roles: string[]) => getPortalEntries(deriveAccessFromRoles(roles)).map((i) => i.url);

describe('experiences/shared/getPortalEntries — links de portal por experiência', () => {
  it('admin: Portal do Admin + Desempenho Institucional (super usuário)', () => {
    expect(urls(['admin'])).toEqual(['/admin/usuarios', '/gestor']);
  });

  it('gestor / gestor_grupo: link para o Desempenho Institucional', () => {
    expect(urls(['gestor'])).toEqual(['/gestor']);
    expect(urls(['gestor_grupo'])).toEqual(['/gestor']);
  });

  it('atendimento (CX): aponta para /atendimento/usuarios (nunca /admin)', () => {
    const out = urls(['atendimento']);
    expect(out).toEqual(['/atendimento/usuarios']);
    expect(out.some((u) => u.startsWith('/admin'))).toBe(false);
  });

  it('aluno/professor: nenhuma entrada de portal', () => {
    expect(urls([])).toEqual([]);
    expect(urls(['professor'])).toEqual([]);
  });

  it('múltiplas roles: uma entrada por portal, na ordem admin > gestão > CX', () => {
    expect(urls(['atendimento', 'admin', 'gestor'])).toEqual([
      '/admin/usuarios',
      '/gestor',
      '/atendimento/usuarios',
    ]);
  });

  it('access nulo/indefinido: nenhuma entrada de portal', () => {
    expect(getPortalEntries(null)).toEqual([]);
    expect(getPortalEntries(undefined)).toEqual([]);
  });
});
