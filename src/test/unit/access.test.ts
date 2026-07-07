/**
 * Testes do módulo de acesso por experiências + capabilities
 * (src/experiences/access.ts) — Fatia 1 do trabalho de experiências apartadas.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveAccessFromRoles,
  can,
  hasExperience,
  parseAccessPayload,
  EMPTY_ACCESS,
  type Access,
} from '@/experiences/access';

describe('experiences/access — deriveAccessFromRoles', () => {
  it('aluno sem role: só a experiência base, sem capabilities', () => {
    const access = deriveAccessFromRoles([]);
    expect(access.experiences).toEqual(['aluno']);
    expect(access.capabilities).toEqual([]);
    expect(access.roles).toEqual([]);
  });

  it('undefined/null roles se comporta como aluno sem role', () => {
    expect(deriveAccessFromRoles(undefined)).toEqual(EMPTY_ACCESS);
    expect(deriveAccessFromRoles(null)).toEqual(EMPTY_ACCESS);
  });

  it('admin ganha experiências admin+gestao e todas as capabilities de admin', () => {
    const access = deriveAccessFromRoles(['admin']);
    expect(access.experiences).toEqual(expect.arrayContaining(['aluno', 'admin', 'gestao']));
    expect(access.experiences).toHaveLength(3);
    expect(access.capabilities).toEqual(
      expect.arrayContaining([
        'users.manage',
        'avisos.manage',
        'ies.manage',
        'guia.manage',
        'sanarclass.manage',
        'simulados.manage',
        'feedbacks.moderate',
        'analytics.view',
        'impersonate',
        'admin.tools',
        'institutional.view',
        'alunos.view',
      ]),
    );
  });

  it('gestor ganha a experiência gestao e as capabilities de gestor', () => {
    const access = deriveAccessFromRoles(['gestor']);
    expect(access.experiences).toEqual(expect.arrayContaining(['aluno', 'gestao']));
    expect(access.experiences).not.toContain('admin');
    expect(access.capabilities).toEqual(expect.arrayContaining(['institutional.view', 'alunos.view']));
    expect(access.capabilities).toHaveLength(2);
  });

  it('gestor_grupo ganha a mesma experiência e capabilities que gestor', () => {
    const access = deriveAccessFromRoles(['gestor_grupo']);
    expect(access.experiences).toEqual(expect.arrayContaining(['aluno', 'gestao']));
    expect(access.capabilities).toEqual(expect.arrayContaining(['institutional.view', 'alunos.view']));
  });

  it('atendimento ganha a experiência atendimento e as capabilities de suporte', () => {
    const access = deriveAccessFromRoles(['atendimento']);
    expect(access.experiences).toEqual(expect.arrayContaining(['aluno', 'atendimento']));
    expect(access.capabilities).toEqual(expect.arrayContaining(['users.support', 'feedbacks.support']));
    expect(access.capabilities).toHaveLength(2);
  });

  it('combinação gestor + atendimento soma as duas experiências e capabilities', () => {
    const access = deriveAccessFromRoles(['gestor', 'atendimento']);
    expect(access.experiences).toEqual(expect.arrayContaining(['aluno', 'gestao', 'atendimento']));
    expect(access.capabilities).toEqual(
      expect.arrayContaining(['institutional.view', 'alunos.view', 'users.support', 'feedbacks.support']),
    );
    expect(access.capabilities).toHaveLength(4);
  });

  it('roles desconhecidas são ignoradas para fins de experiência/capability mas mantidas em roles[]', () => {
    const access = deriveAccessFromRoles(['professor', 'role-inexistente']);
    expect(access.roles).toEqual(['professor', 'role-inexistente']);
    expect(access.experiences).toEqual(['aluno']);
    expect(access.capabilities).toEqual([]);
  });
});

describe('experiences/access — can', () => {
  const adminAccess = deriveAccessFromRoles(['admin']);
  const alunoAccess = deriveAccessFromRoles([]);

  it('retorna true quando a capability está presente', () => {
    expect(can(adminAccess, 'users.manage')).toBe(true);
  });

  it('retorna false quando a capability não está presente', () => {
    expect(can(alunoAccess, 'users.manage')).toBe(false);
  });

  it('retorna false com access null/undefined (fail-closed)', () => {
    expect(can(null, 'users.manage')).toBe(false);
    expect(can(undefined, 'impersonate')).toBe(false);
  });
});

describe('experiences/access — hasExperience', () => {
  it('aluno sempre retorna true, mesmo sem access', () => {
    expect(hasExperience(null, 'aluno')).toBe(true);
    expect(hasExperience(undefined, 'aluno')).toBe(true);
    expect(hasExperience(EMPTY_ACCESS, 'aluno')).toBe(true);
  });

  it('outras experiências dependem do access conter a experiência', () => {
    const gestaoAccess = deriveAccessFromRoles(['gestor']);
    expect(hasExperience(gestaoAccess, 'gestao')).toBe(true);
    expect(hasExperience(gestaoAccess, 'admin')).toBe(false);
    expect(hasExperience(gestaoAccess, 'atendimento')).toBe(false);
  });

  it('retorna false para experiências não-aluno com access null/undefined', () => {
    expect(hasExperience(null, 'admin')).toBe(false);
    expect(hasExperience(undefined, 'gestao')).toBe(false);
  });
});

describe('experiences/access — parseAccessPayload', () => {
  it('aceita um payload válido e preserva seus campos', () => {
    const payload = {
      roles: ['admin'],
      experiences: ['aluno', 'admin', 'gestao'],
      capabilities: ['users.manage', 'impersonate'],
    };
    const parsed = parseAccessPayload(payload);
    expect(parsed).toEqual({
      roles: ['admin'],
      experiences: ['aluno', 'admin', 'gestao'],
      capabilities: ['users.manage', 'impersonate'],
    });
  });

  it('normaliza experiências desconhecidas: filtra inválidas e garante aluno como base', () => {
    const payload = {
      roles: ['gestor'],
      experiences: ['gestao', 'experiencia-invalida'],
      capabilities: ['institutional.view'],
    };
    const parsed = parseAccessPayload(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.experiences).toEqual(['gestao']);
  });

  it('devolve null para payload null/undefined', () => {
    expect(parseAccessPayload(null)).toBeNull();
    expect(parseAccessPayload(undefined)).toBeNull();
  });

  it('devolve null para payload sem os arrays esperados (formato inválido)', () => {
    expect(parseAccessPayload({})).toBeNull();
    expect(parseAccessPayload({ roles: ['admin'] })).toBeNull();
    expect(parseAccessPayload('not-an-object')).toBeNull();
    expect(parseAccessPayload(42)).toBeNull();
  });

  it('filtra entradas não-string dentro dos arrays', () => {
    const payload = {
      roles: ['admin', 42, null],
      experiences: ['admin', 99],
      capabilities: ['users.manage', {}],
    };
    const parsed = parseAccessPayload(payload) as Access;
    expect(parsed.roles).toEqual(['admin']);
    expect(parsed.experiences).toEqual(['admin']);
    expect(parsed.capabilities).toEqual(['users.manage']);
  });
});
