import { describe, it, expect } from 'vitest';
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

describe('utils/accessRules — gestor tem a experiência de aluno completa', () => {
  const gestorRules = getAccessRules(makeUser(['gestor']));

  it('libera todas as telas de aluno', () => {
    expect(gestorRules.home).toBe(true);
    expect(gestorRules.studyGuide).toBe(true);
    expect(gestorRules.dashboard).toBe(true);
    expect(gestorRules.sanarclass).toBe(true);
    expect(gestorRules.errorNotebook).toBe(true);
    expect(gestorRules.simulados).toBe(true);
  });

  it('mantém os flags de gestão', () => {
    expect(gestorRules.desempenhoInstitucional).toBe(true);
    expect(gestorRules.SimuladoDesempenho).toBe(true);
  });

  it('não vira admin (userManagement/analytics off)', () => {
    expect(gestorRules.userManagement).toBe(false);
    expect(gestorRules.analytics).toBe(false);
  });

  it('gestor_grupo recebe as mesmas regras', () => {
    const grupo = getAccessRules(makeUser(['gestor_grupo']));
    expect(grupo.home).toBe(true);
    expect(grupo.desempenhoInstitucional).toBe(true);
  });
});
