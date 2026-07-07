import { describe, it, expect } from 'vitest';
import { getDefaultRouteForUser, EXPERIENCE_ENTRYPOINTS } from '@/utils/experiences';
import { deriveAccessFromRoles, hasExperience } from '@/experiences/access';
import { getAccessRules } from '@/utils/accessRules';
import { AccessRules, User } from '@/types';

/** Cria um User mínimo com as roles informadas. */
const makeUser = (roles: string[]): User => ({
  id: 'u1',
  email: 'u1@example.com',
  nome: 'Usuário',
  id_ies: 'ies-1',
  ies_nome: 'IES 1',
  roles,
});

/** AccessRules base de aluno (apenas simulados liberado, como DEFAULT_RULES). */
const alunoRules: AccessRules = getAccessRules(makeUser([]));

describe('experiences/access — deriveAccessFromRoles (experiências por role)', () => {
  it('admin ganha as experiências admin + gestao', () => {
    const access = deriveAccessFromRoles(['admin']);
    expect(access.experiences).toEqual(expect.arrayContaining(['aluno', 'admin', 'gestao']));
  });

  it('atendimento ganha a experiência atendimento', () => {
    const access = deriveAccessFromRoles(['atendimento']);
    expect(access.experiences).toEqual(expect.arrayContaining(['aluno', 'atendimento']));
    expect(access.experiences).not.toContain('admin');
  });

  it('gestor e gestor_grupo ganham a experiência gestao', () => {
    expect(deriveAccessFromRoles(['gestor']).experiences).toEqual(
      expect.arrayContaining(['aluno', 'gestao']),
    );
    expect(deriveAccessFromRoles(['gestor_grupo']).experiences).toEqual(
      expect.arrayContaining(['aluno', 'gestao']),
    );
  });

  it('professor não ganha experiência extra (usa a base aluno)', () => {
    expect(deriveAccessFromRoles(['professor']).experiences).toEqual(['aluno']);
  });

  it('fallback: sem roles (ou roles undefined/null) só tem a experiência aluno', () => {
    expect(deriveAccessFromRoles([]).experiences).toEqual(['aluno']);
    expect(deriveAccessFromRoles(undefined).experiences).toEqual(['aluno']);
    expect(deriveAccessFromRoles(null).experiences).toEqual(['aluno']);
  });

  it('múltiplas roles são aditivas', () => {
    const access = deriveAccessFromRoles(['professor', 'gestor', 'admin']);
    expect(access.experiences).toEqual(
      expect.arrayContaining(['aluno', 'admin', 'gestao']),
    );
  });
});

describe('experiences/access — hasExperience', () => {
  it('aluno é sempre true, mesmo com access nulo/indefinido', () => {
    expect(hasExperience(null, 'aluno')).toBe(true);
    expect(hasExperience(undefined, 'aluno')).toBe(true);
    expect(hasExperience(deriveAccessFromRoles([]), 'aluno')).toBe(true);
  });

  it('admin só para quem tem a experiência admin', () => {
    expect(hasExperience(deriveAccessFromRoles(['admin']), 'admin')).toBe(true);
    expect(hasExperience(deriveAccessFromRoles(['gestor']), 'admin')).toBe(false);
    expect(hasExperience(deriveAccessFromRoles([]), 'admin')).toBe(false);
  });

  it('gestao cobre gestor, gestor_grupo e admin (super usuário)', () => {
    expect(hasExperience(deriveAccessFromRoles(['gestor']), 'gestao')).toBe(true);
    expect(hasExperience(deriveAccessFromRoles(['gestor_grupo']), 'gestao')).toBe(true);
    expect(hasExperience(deriveAccessFromRoles(['admin']), 'gestao')).toBe(true);
    expect(hasExperience(deriveAccessFromRoles(['atendimento']), 'gestao')).toBe(false);
    expect(hasExperience(deriveAccessFromRoles([]), 'gestao')).toBe(false);
  });

  it('atendimento só para quem tem a experiência atendimento', () => {
    expect(hasExperience(deriveAccessFromRoles(['atendimento']), 'atendimento')).toBe(true);
    expect(hasExperience(deriveAccessFromRoles(['admin']), 'atendimento')).toBe(false);
  });
});

describe('utils/experiences — getDefaultRouteForUser', () => {
  it('admin entra na experiência admin (/admin/usuarios)', () => {
    const user = makeUser(['admin']);
    const access = deriveAccessFromRoles(user.roles);
    expect(getDefaultRouteForUser(user, getAccessRules(user), access)).toBe(
      EXPERIENCE_ENTRYPOINTS.admin,
    );
    expect(getDefaultRouteForUser(user, getAccessRules(user), access)).toBe(
      '/admin/usuarios',
    );
  });

  it('atendimento entra na experiência de atendimento (/atendimento/usuarios)', () => {
    const user = makeUser(['atendimento']);
    const access = deriveAccessFromRoles(user.roles);
    expect(getDefaultRouteForUser(user, getAccessRules(user), access)).toBe(
      EXPERIENCE_ENTRYPOINTS.atendimento,
    );
    expect(getDefaultRouteForUser(user, getAccessRules(user), access)).toBe(
      '/atendimento/usuarios',
    );
  });

  it('gestão entra na experiência do gestor (/gestor)', () => {
    const user = makeUser(['gestor']);
    const access = deriveAccessFromRoles(user.roles);
    expect(getDefaultRouteForUser(user, getAccessRules(user), access)).toBe(
      EXPERIENCE_ENTRYPOINTS.gestao,
    );
    expect(getDefaultRouteForUser(user, getAccessRules(user), access)).toBe('/gestor');

    const grupo = makeUser(['gestor_grupo']);
    const grupoAccess = deriveAccessFromRoles(grupo.roles);
    expect(getDefaultRouteForUser(grupo, getAccessRules(grupo), grupoAccess)).toBe('/gestor');
  });

  it('professor entra na raiz (home na nova rota /)', () => {
    const user = makeUser(['professor']);
    const access = deriveAccessFromRoles(user.roles);
    expect(getDefaultRouteForUser(user, getAccessRules(user), access)).toBe('/');
  });

  it('admin com múltiplas experiências segue a precedência admin > atendimento > gestao', () => {
    const user = makeUser(['admin']);
    // access sintético só para testar a precedência isoladamente.
    const access = deriveAccessFromRoles(['admin', 'atendimento', 'gestor']);
    expect(getDefaultRouteForUser(user, getAccessRules(user), access)).toBe(
      '/admin/usuarios',
    );
  });

  it('sem access explícito (undefined), cai no comportamento de aluno (compat)', () => {
    expect(getDefaultRouteForUser(makeUser([]), alunoRules)).toBe('/simulados');
  });

  it('o entrypoint de cada experiência é sempre uma tela liberada (sem loop de redirect)', () => {
    const admin = makeUser(['admin']);
    expect(getAccessRules(admin).userManagement).toBe(true);

    const cx = makeUser(['atendimento']);
    expect(getAccessRules(cx).userManagement).toBe(true);

    const gestor = makeUser(['gestor']);
    expect(getAccessRules(gestor).desempenhoInstitucional).toBe(true);
  });

  describe('aluno: home dinâmica por telas liberadas', () => {
    const alunoAccess = deriveAccessFromRoles([]);

    it('cai em /simulados quando só simulados está liberado (DEFAULT)', () => {
      expect(getDefaultRouteForUser(makeUser([]), alunoRules, alunoAccess)).toBe(
        '/simulados',
      );
    });

    it('prioriza a raiz (/) quando a IES libera a home', () => {
      const rules: AccessRules = { ...alunoRules, home: true };
      expect(getDefaultRouteForUser(makeUser([]), rules, alunoAccess)).toBe('/');
    });

    it('cai em /guia-estudos quando home e simulados estão bloqueados', () => {
      const rules: AccessRules = {
        ...alunoRules,
        home: false,
        simulados: false,
        studyGuide: true,
      };
      expect(getDefaultRouteForUser(makeUser([]), rules, alunoAccess)).toBe(
        '/guia-estudos',
      );
    });
  });
});
