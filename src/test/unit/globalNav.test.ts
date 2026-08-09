import { describe, it, expect } from 'vitest';
import {
  getExperienceOptions,
  resolveCurrentExperience,
} from '@/experiences/shared/globalNav';
import { deriveAccessFromRoles } from '@/experiences/access';

const ids = (roles: string[]) => getExperienceOptions(deriveAccessFromRoles(roles)).map((o) => o.id);

describe('experiences/shared/getExperienceOptions — experiências (portais) do usuário', () => {
  it('aluno puro: só a experiência de aluno (nada a alternar)', () => {
    expect(ids([])).toEqual(['aluno']);
  });

  it('gestor / gestor_grupo: aluno + gestão', () => {
    expect(ids(['gestor'])).toEqual(['aluno', 'gestao']);
    expect(ids(['gestor_grupo'])).toEqual(['aluno', 'gestao']);
  });

  it('admin: aluno + admin + gestão (super usuário)', () => {
    expect(ids(['admin'])).toEqual(['aluno', 'admin', 'gestao']);
  });

  it('atendimento: aluno + atendimento, no entrypoint do CX', () => {
    const options = getExperienceOptions(deriveAccessFromRoles(['atendimento']));
    expect(options.map((o) => o.id)).toEqual(['aluno', 'atendimento']);
    expect(options.find((o) => o.id === 'atendimento')?.url).toBe('/atendimento/usuarios');
  });

  it('sem access: a base (aluno) ainda existe', () => {
    expect(ids([])).toEqual(['aluno']);
    expect(getExperienceOptions(null).map((o) => o.id)).toEqual(['aluno']);
    expect(getExperienceOptions(undefined).map((o) => o.id)).toEqual(['aluno']);
  });

  it('resolveCurrentExperience: deriva a experiência da rota, com aluno como base', () => {
    expect(resolveCurrentExperience('/admin/usuarios')).toBe('admin');
    expect(resolveCurrentExperience('/gestor/detalhamento')).toBe('gestao');
    expect(resolveCurrentExperience('/atendimento/usuarios')).toBe('atendimento');
    expect(resolveCurrentExperience('/guia-estudos')).toBe('aluno');
    expect(resolveCurrentExperience('/')).toBe('aluno');
  });
});
