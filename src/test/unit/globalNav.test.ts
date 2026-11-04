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

  it('mentor puro: só a opção Mentor (o seletor some, pois ele esconde com menos de 2)', () => {
    const options = getExperienceOptions(deriveAccessFromRoles(['mentor']));
    expect(options.map((o) => o.id)).toEqual(['mentor']);
    expect(options[0].url).toBe('/mentor');
  });

  it('mentor que também é gestor alterna entre Gestor e Mentor, sem Aluno', () => {
    expect(ids(['gestor', 'mentor'])).toEqual(['gestao', 'mentor']);
  });

  it('staff que também é mentor continua vendo Aluno', () => {
    expect(ids(['admin', 'mentor'])).toEqual(['aluno', 'admin', 'gestao', 'mentor']);
    expect(ids(['atendimento', 'mentor'])).toEqual(['aluno', 'atendimento', 'mentor']);
  });

  it('o portal do gestor aparece como "Gestor", não "Gestão"', () => {
    const options = getExperienceOptions(deriveAccessFromRoles(['gestor']));
    expect(options.find((o) => o.id === 'gestao')?.label).toBe('Gestor');
  });

  it('resolveCurrentExperience reconhece /mentor', () => {
    expect(resolveCurrentExperience('/mentor')).toBe('mentor');
    expect(resolveCurrentExperience('/mentor/turma')).toBe('mentor');
  });
});
