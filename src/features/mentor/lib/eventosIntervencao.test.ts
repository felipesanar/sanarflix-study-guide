import { describe, expect, it } from 'vitest';
import { efeitoDoEvento } from './eventosIntervencao';
import type { Intervencao, Publicacao, Sessao } from '../api/types';

const sessao: Sessao = { id: 's', tipo: 'oficina', data: '2026-11-19', hora: '20:00', tema: 'HAS', alunoId: null, link: null, status: 'agendada', gravacaoUrl: null, pauta: [] };
const publicacao: Publicacao = { id: 'p', tag: 'aviso', titulo: 'Aviso', mensagem: 'Olá', link: null, anexoUrl: null, destino: { tipo: 'turma' }, status: 'publicada', publicadaEm: null };
const card: Intervencao = { id: 'c', tipo: 'coletiva', titulo: 'HAS', nota: null, destino: { turmaToda: true }, perfil: null, status: 'afazer', origem: 'sessao_criada', referenciaId: 's', criadaEm: '2026-11-04', historico: [] };

describe('tabela ação → efeito (docs/06)', () => {
  it('mural só registra quando solicitado, com destino preservado', () => {
    expect(efeitoDoEvento({ tipo: 'mural_publicado', publicacao, registrarIntervencao: false, descricaoDestino: 'Turma' }, [])).toEqual({});
    expect(efeitoDoEvento({ tipo: 'mural_publicado', publicacao, registrarIntervencao: true, descricaoDestino: 'Turma' }, []).criar).toMatchObject({ tipo: 'mensagem', status: 'feito', origem: 'mural', referenciaId: 'p', destino: { turmaToda: true } });
    expect(efeitoDoEvento({ tipo: 'mural_publicado', publicacao: { ...publicacao, destino: { tipo: 'selecionados', alunoIds: ['a'] } }, registrarIntervencao: true, descricaoDestino: 'A' }, []).criar?.destino).toEqual({ alunoIds: ['a'] });
  });
  it('agenda liberada cria individual e log do aluno', () => {
    const r = efeitoDoEvento({ tipo: 'agenda_liberada', alunoId: 'a', alunoNome: 'Ana Silva' }, []);
    expect(r.criar).toMatchObject({ tipo: 'individual', status: 'afazer', origem: 'agenda_liberada', destino: { alunoIds: ['a'] } });
    expect(r.log).toEqual([{ alunoId: 'a', texto: 'Agendamento individual liberado' }]);
  });
  it.each(['individual', 'encontro_tribo', 'pos_simulado', 'oficina'] as const)('sessão %s cria o tipo correto', tipo => {
    expect(efeitoDoEvento({ tipo: 'sessao_criada', sessao: { ...sessao, tipo, alunoId: tipo === 'individual' ? 'a' : null } }, []).criar).toMatchObject({ tipo: tipo === 'individual' ? 'individual' : 'coletiva', status: 'afazer', origem: 'sessao_criada', referenciaId: 's' });
  });
  it('realizada move apenas cards ligados à sessão e preserva entradas', () => {
    const cards = [card, { ...card, id: 'outro', origem: 'questao' as const }, { ...card, id: 'feito', status: 'feito' as const }];
    const antes = JSON.stringify(cards);
    expect(efeitoDoEvento({ tipo: 'sessao_realizada', sessao }, cards).mover).toEqual([{ id: 'c', status: 'feito' }]);
    expect(JSON.stringify(cards)).toBe(antes);
  });
  it('realizada sem card cria em Feito; card já feito não é duplicado', () => {
    expect(efeitoDoEvento({ tipo: 'sessao_realizada', sessao }, []).criar).toMatchObject({ tipo: 'coletiva', status: 'feito', origem: 'sessao_criada', referenciaId: 's' });
    expect(efeitoDoEvento({ tipo: 'sessao_realizada', sessao }, [{ ...card, status: 'feito' }]).criar).toBeUndefined();
  });
  it.each(['tema_critico', 'questao'] as const)('%s cria coletiva A fazer', origem => {
    expect(efeitoDoEvento({ tipo: 'intervencao_tema', temaId: 't', tema: 'HAS', acertoPct: 40, origem }, []).criar).toMatchObject({ tipo: 'coletiva', status: 'afazer', origem, referenciaId: 't' });
  });
  it('drawer do aluno preserva perfil B2B', () => {
    expect(efeitoDoEvento({ tipo: 'intervencao_aluno', alunoId: 'a', alunoNome: 'Ana', perfil: 'virada' }, []).criar).toMatchObject({ tipo: 'individual', status: 'afazer', origem: 'manual', perfil: 'virada' });
  });
  it('WhatsApp só registra no log, sem criar card', () => {
    expect(efeitoDoEvento({ tipo: 'whatsapp_aberto', alunoId: 'a' }, [])).toEqual({ log: [{ alunoId: 'a', texto: 'WhatsApp aberto pelo Academy' }] });
  });
  it('mudança de status gera histórico sem mutar o card', () => {
    expect(efeitoDoEvento({ tipo: 'status_alterado', intervencaoId: 'c', status: 'andamento' }, [card])).toEqual({ mover: [{ id: 'c', status: 'andamento' }], historico: [{ intervencaoId: 'c', texto: 'Status alterado para Em andamento' }] });
    expect(card.status).toBe('afazer');
  });
});
