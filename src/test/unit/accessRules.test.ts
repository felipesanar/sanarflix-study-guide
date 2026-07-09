import { describe, it, expect } from 'vitest';
import { isAdmin, isProfessor, isGestor, isGestorGrupo, isAtendimento } from '@/utils/accessRules';
import type { User } from '@/types';

const makeUser = (roles: string[]): User => ({
  id: 'u1',
  email: 'u1@example.com',
  nome: 'Usuário',
  id_ies: 'ies-1',
  ies_nome: 'IES 1',
  roles,
});

describe('utils/accessRules — helpers de escopo de dados (isAdmin/isProfessor/isGestor/isAtendimento)', () => {
  it('isAdmin identifica a role admin', () => {
    expect(isAdmin(makeUser(['admin']))).toBe(true);
    expect(isAdmin(makeUser(['gestor']))).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('isProfessor identifica a role professor', () => {
    expect(isProfessor(makeUser(['professor']))).toBe(true);
    expect(isProfessor(makeUser(['admin']))).toBe(false);
    expect(isProfessor(null)).toBe(false);
  });

  it('isGestor cobre as variantes gestor e gestor_grupo', () => {
    expect(isGestor(makeUser(['gestor']))).toBe(true);
    expect(isGestor(makeUser(['gestor_grupo']))).toBe(true);
    expect(isGestor(makeUser(['admin']))).toBe(false);
    expect(isGestor(null)).toBe(false);
  });

  it('isGestorGrupo só identifica o gestor de grupo educacional (multi-IES)', () => {
    expect(isGestorGrupo(makeUser(['gestor_grupo']))).toBe(true);
    expect(isGestorGrupo(makeUser(['gestor']))).toBe(false);
    expect(isGestorGrupo(null)).toBe(false);
  });

  it('isAtendimento identifica a role atendimento', () => {
    expect(isAtendimento(makeUser(['atendimento']))).toBe(true);
    expect(isAtendimento(makeUser(['gestor']))).toBe(false);
    expect(isAtendimento(null)).toBe(false);
  });
});
