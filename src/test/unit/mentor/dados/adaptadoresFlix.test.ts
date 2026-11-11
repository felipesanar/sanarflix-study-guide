import { describe, expect, it } from 'vitest';
import type { components } from '@/features/mentor/api/contrato/tipos.gerado';
import { alunoDaApi, canalDaApi, meDaApi, tipoCanalParaApi } from '@/features/mentor/api/adaptadoresFlix';

describe('adaptadores Flix v2.3', () => {
  it('preserva o perfil e o toggle de cada tribo sem depender do portal no Flix', () => {
    const mentor: components['schemas']['Mentor'] = { id: 'm', nome: 'Mentor', fotoUrl: null, bio: 'Bio', mote: 'Mote', googleEmail: 'mentor@exemplo.com', modalidade: 'b2c', ativo: false };
    const tribo: components['schemas']['TriboMe'] = { id: 't', nome: 'Tribo', slug: 'tribo', modalidade: 'b2c', papel: 'apoio', lema: null, iconeUrl: null, cores: null, iesId: null, iesNome: null, campus: null, encontrosPorMes: null, totalAlunos: 12, mentoriaAtiva: false };
    expect(meDaApi({ mentor, tribos: [tribo] })).toEqual({ mentor: { ...mentor, agendaUrl: null }, tribos: [tribo], portalMentor: true });
    expect(meDaApi({ mentor: { ...mentor, bio: null, mote: null, googleEmail: null }, tribos: [{ ...tribo, mentoriaAtiva: true }] })).toMatchObject({ mentor: { bio: null, mote: null, googleEmail: null }, tribos: [{ mentoriaAtiva: true }] });
  });

  it('preserva UUID, email e todos os campos do aluno sem mutar a entrada', () => {
    const aluno: components['schemas']['Aluno'] = { alunoId: '00000000-0000-4000-8000-000000000001', nome: 'Ana', email: 'ana@exemplo.com', whatsapp: null, produto: 'pro', acessoAte: null, semestre: null, campus: null, triboId: 't', entrouNaTriboEm: '2026-11-01T12:00:00Z', origemAlocacao: 'cx', ultimaAtividadeEm: null, meta: { especialidade: 'CM', instituicao: 'USP', cortePct: 80 } };
    expect(alunoDaApi(Object.freeze(aluno))).toEqual(aluno);
  });

  it.each(['avisos', 'plantao', 'grupo_tribo'] as const)('adapta %s e converte o tipo de volta', (tipo) => {
    const esperado = tipo === 'grupo_tribo' ? 'grupo_turma' : tipo;
    const canal = { triboId: 't', tipo, nome: 'Canal', url: null, editavel: tipo === 'grupo_tribo' };
    expect(canalDaApi(Object.freeze(canal))).toEqual({ tipo: esperado, nome: 'Canal', url: '', editavel: canal.editavel, configurado: false });
    expect(canalDaApi({ ...canal, url: 'https://chat.whatsapp.com/x' })).toMatchObject({ url: 'https://chat.whatsapp.com/x', configurado: true });
    expect(tipoCanalParaApi(esperado)).toBe(tipo);
  });
});
