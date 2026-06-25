import { describe, it, expect } from 'vitest';
import {
  getExperience,
  getDefaultRouteForUser,
  EXPERIENCE_ENTRYPOINTS,
} from '@/utils/experiences';
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

describe('utils/experiences — getExperience', () => {
  it('roteia admin para a experiência admin', () => {
    expect(getExperience(makeUser(['admin']))).toBe('admin');
  });

  it('roteia atendimento para a experiência atendimento', () => {
    expect(getExperience(makeUser(['atendimento']))).toBe('atendimento');
  });

  it('roteia gestor para a experiência de gestão', () => {
    expect(getExperience(makeUser(['gestor']))).toBe('gestao');
  });

  it('roteia gestor_grupo para a experiência de gestão', () => {
    expect(getExperience(makeUser(['gestor_grupo']))).toBe('gestao');
  });

  it('roteia professor para a experiência aluno+professor', () => {
    expect(getExperience(makeUser(['professor']))).toBe('aluno_professor');
  });

  it('fallback: usuário sem roles cai em aluno+professor', () => {
    expect(getExperience(makeUser([]))).toBe('aluno_professor');
    expect(getExperience(makeUser(undefined as unknown as string[]))).toBe(
      'aluno_professor',
    );
  });

  it('fallback: usuário nulo cai em aluno+professor', () => {
    expect(getExperience(null)).toBe('aluno_professor');
  });

  describe('precedência com múltiplas roles', () => {
    it('admin vence todas as demais', () => {
      expect(getExperience(makeUser(['professor', 'gestor', 'admin']))).toBe(
        'admin',
      );
      expect(getExperience(makeUser(['atendimento', 'admin']))).toBe('admin');
    });

    it('atendimento vence gestão e aluno/professor', () => {
      expect(getExperience(makeUser(['gestor', 'atendimento']))).toBe(
        'atendimento',
      );
      expect(getExperience(makeUser(['professor', 'atendimento']))).toBe(
        'atendimento',
      );
    });

    it('gestão vence professor/aluno', () => {
      expect(getExperience(makeUser(['professor', 'gestor']))).toBe('gestao');
      expect(getExperience(makeUser(['gestor_grupo', 'professor']))).toBe(
        'gestao',
      );
    });
  });
});

describe('utils/experiences — getDefaultRouteForUser', () => {
  it('admin entra na experiência admin (/admin/usuarios)', () => {
    const user = makeUser(['admin']);
    expect(getDefaultRouteForUser(user, getAccessRules(user))).toBe(
      EXPERIENCE_ENTRYPOINTS.admin,
    );
    expect(getDefaultRouteForUser(user, getAccessRules(user))).toBe(
      '/admin/usuarios',
    );
  });

  it('atendimento entra na experiência de atendimento (/atendimento/usuarios)', () => {
    const user = makeUser(['atendimento']);
    expect(getDefaultRouteForUser(user, getAccessRules(user))).toBe(
      EXPERIENCE_ENTRYPOINTS.atendimento,
    );
    expect(getDefaultRouteForUser(user, getAccessRules(user))).toBe(
      '/atendimento/usuarios',
    );
  });

  it('gestão entra na experiência do gestor (/gestor)', () => {
    const user = makeUser(['gestor']);
    expect(getDefaultRouteForUser(user, getAccessRules(user))).toBe(
      EXPERIENCE_ENTRYPOINTS.gestao,
    );
    expect(getDefaultRouteForUser(user, getAccessRules(user))).toBe('/gestor');
    const grupo = makeUser(['gestor_grupo']);
    expect(getDefaultRouteForUser(grupo, getAccessRules(grupo))).toBe('/gestor');
  });

  it('professor entra na raiz (home na nova rota /)', () => {
    const user = makeUser(['professor']);
    expect(getDefaultRouteForUser(user, getAccessRules(user))).toBe('/');
  });

  it('o entrypoint de cada experiência é sempre uma tela liberada (sem loop de redirect)', () => {
    const admin = makeUser(['admin']);
    expect(getAccessRules(admin).userManagement).toBe(true);

    const cx = makeUser(['atendimento']);
    expect(getAccessRules(cx).userManagement).toBe(true);

    const gestor = makeUser(['gestor']);
    expect(getAccessRules(gestor).desempenhoInstitucional).toBe(true);
  });

  describe('aluno + professor: home dinâmica por telas liberadas', () => {
    it('cai em /simulados quando só simulados está liberado (DEFAULT)', () => {
      expect(getDefaultRouteForUser(makeUser([]), alunoRules)).toBe(
        '/simulados',
      );
    });

    it('prioriza a raiz (/) quando a IES libera a home', () => {
      const rules: AccessRules = { ...alunoRules, home: true };
      expect(getDefaultRouteForUser(makeUser([]), rules)).toBe('/');
    });

    it('cai em /guia-estudos quando home e simulados estão bloqueados', () => {
      const rules: AccessRules = {
        ...alunoRules,
        home: false,
        simulados: false,
        studyGuide: true,
      };
      expect(getDefaultRouteForUser(makeUser([]), rules)).toBe('/guia-estudos');
    });
  });
});
