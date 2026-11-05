import { describe, expect, it } from 'vitest';
import type { Intervencao } from '@/features/mentor/api/types';
import {
  META_MENSAL,
  ddmmDeIso,
  filtrarCards,
  hojeSP,
  historicoExibido,
  intervaloPeriodo,
  medidorDoMes,
  mesDe,
  paraQuem,
  rotuloIntervalo,
  rotuloOrigem,
  rotuloTipo,
} from '@/features/mentor/components/intervencoes-v2/util';

const card = (over: Partial<Intervencao> = {}): Intervencao => ({
  id: 'c1', tipo: 'individual', titulo: 'T', nota: null, destino: { alunoIds: ['ana@x.com'] }, perfil: null,
  status: 'afazer', origem: 'manual', referenciaId: null, criadaEm: '2026-10-10T15:00:00Z',
  historico: [{ em: '2026-10-10T15:00:00Z', texto: 'Intervenção criada' }], comentarios: [], ...over,
});

describe('datas (America/Sao_Paulo)', () => {
  it('hojeSP usa o fuso de São Paulo', () => {
    expect(hojeSP(new Date('2026-10-16T01:30:00Z'))).toBe('2026-10-15');
  });
  it('ddmm de ISO no fuso de SP', () => {
    expect(ddmmDeIso('2026-10-01T02:00:00Z')).toBe('30/09');
    expect(ddmmDeIso('')).toBe('—');
  });
});

describe('intervaloPeriodo', () => {
  it('semana = segunda a domingo da semana de hoje', () => {
    expect(intervaloPeriodo('semana', '2026-10-15')).toEqual({ de: '2026-10-12', ate: '2026-10-18' });
    expect(intervaloPeriodo('semana', '2026-10-18')).toEqual({ de: '2026-10-12', ate: '2026-10-18' });
  });
  it('quinzena = 1ª (1–15) ou 2ª (16–fim) metade do mês', () => {
    expect(intervaloPeriodo('quinzena', '2026-10-15')).toEqual({ de: '2026-10-01', ate: '2026-10-15' });
    expect(intervaloPeriodo('quinzena', '2026-10-16')).toEqual({ de: '2026-10-16', ate: '2026-10-31' });
    expect(intervaloPeriodo('quinzena', '2026-02-20')).toEqual({ de: '2026-02-16', ate: '2026-02-28' });
  });
  it('mês = mês inteiro', () => {
    expect(intervaloPeriodo('mes', '2026-10-15')).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
  });
  it('intervalo só vale completo e em ordem', () => {
    expect(intervaloPeriodo('intervalo', '2026-10-15', { de: '2026-10-02', ate: '2026-10-09' })).toEqual({ de: '2026-10-02', ate: '2026-10-09' });
    expect(intervaloPeriodo('intervalo', '2026-10-15', { de: '2026-10-09', ate: '2026-10-02' })).toBeNull();
    expect(intervaloPeriodo('intervalo', '2026-10-15', { de: '', ate: '2026-10-02' })).toBeNull();
  });
  it('rótulo do intervalo', () => {
    expect(rotuloIntervalo('quinzena', { de: '2026-10-01', ate: '2026-10-15' })).toBe('01/10 a 15/10');
    expect(rotuloIntervalo('mes', { de: '2026-10-01', ate: '2026-10-31' })).toBe('outubro');
  });
  it('mês de referência do medidor', () => {
    expect(mesDe('2026-10-15')).toEqual({ de: '2026-10-01', ate: '2026-10-31', nome: 'outubro', ultimoDia: '31/10' });
  });
});

describe('medidor', () => {
  it('meta de 15 por mês (P6), faltam nunca negativo', () => {
    expect(META_MENSAL).toBe(15);
    expect(medidorDoMes(9)).toEqual({ feitas: 9, faltam: 6, preenchidos: 9 });
    expect(medidorDoMes(20)).toEqual({ feitas: 20, faltam: 0, preenchidos: 15 });
  });
});

describe('rótulos', () => {
  it('tipo por modalidade é texto neutro', () => {
    expect(rotuloTipo('individual', 'b2c')).toBe('Reunião individual');
    expect(rotuloTipo('coletiva', 'b2c')).toBe('Reunião coletiva');
    expect(rotuloTipo('coletiva', 'b2b')).toBe('Sessão coletiva');
    expect(rotuloTipo('mensagem', 'b2b')).toBe('Mensagem');
  });
  it('origem', () => {
    expect(rotuloOrigem('manual')).toBe('Manual');
    expect(rotuloOrigem('agenda_liberada')).toBe('Auto · agenda liberada');
    expect(rotuloOrigem('tema_critico')).toBe('Auto · tema crítico');
    expect(rotuloOrigem('mural')).toBe('Auto · mural');
    expect(rotuloOrigem('sessao_criada')).toBe('Auto · sessão criada');
    expect(rotuloOrigem('questao')).toBe('Auto · questão');
  });
});

describe('paraQuem', () => {
  const nomes = new Map([['ana@x.com', 'Ana Souza']]);
  it('aluno único pelo nome, com e-mail de reserva', () => {
    expect(paraQuem(card(), nomes)).toBe('Ana Souza');
    expect(paraQuem(card({ destino: { alunoIds: ['bia@x.com'] } }), nomes)).toBe('bia@x.com');
  });
  it('turma, grupo e ausência', () => {
    expect(paraQuem(card({ destino: { turmaToda: true, alunoIds: ['a', 'b'] } }), nomes)).toBe('Turma toda');
    expect(paraQuem(card({ destino: { alunoIds: ['a', 'b', 'c'] } }), nomes)).toBe('3 alunos');
    expect(paraQuem(card({ destino: { alunoIds: ['a', 'b'], grupo: 'Sumiram' } }), nomes)).toBe('Sumiram · 2 alunos');
    expect(paraQuem(card({ destino: {} }), nomes)).toBe('—');
  });
});

describe('historicoExibido', () => {
  it('criação, status e comentários em ordem cronológica, sem duplicar o evento de comentário', () => {
    const c = card({
      origem: 'agenda_liberada',
      historico: [
        { em: '2026-10-10T15:00:00Z', texto: 'Intervenção criada' },
        { em: '2026-10-11T15:00:00Z', texto: 'Status alterado para Em andamento' },
        { em: '2026-10-12T15:00:00Z', texto: 'Comentário adicionado' },
      ],
      comentarios: [{ em: '2026-10-12T15:00:00Z', texto: 'Mandei áudio' }],
    });
    expect(historicoExibido(c).map((h) => h.texto)).toEqual([
      'Criada · Auto · agenda liberada', 'Status → Em andamento', 'Comentário: Mandei áudio',
    ]);
    expect(historicoExibido(c)[0].data).toBe('10/10');
  });
  it('sem evento de criação, a criação entra pela data do card', () => {
    const c = card({ origem: 'sessao_criada', historico: [{ em: '2026-10-11T15:00:00Z', texto: 'Sessão realizada' }] });
    expect(historicoExibido(c).map((h) => h.texto)).toEqual(['Criada · Auto · sessão criada', 'Sessão realizada']);
  });
});

describe('filtrarCards', () => {
  const cards = [
    card({ id: 'a', tipo: 'individual', perfil: 'virada' }),
    card({ id: 'b', tipo: 'coletiva', perfil: null }),
    card({ id: 'c', tipo: 'mensagem', perfil: 'muito_baixo' }),
  ];
  it('B2C filtra por tipo', () => {
    expect(filtrarCards(cards, { modalidade: 'b2c', tipo: 'coletiva', perfil: 'todos' }).map((c) => c.id)).toEqual(['b']);
    expect(filtrarCards(cards, { modalidade: 'b2c', tipo: 'todos', perfil: 'virada' })).toHaveLength(3);
  });
  it('B2B filtra por perfil', () => {
    expect(filtrarCards(cards, { modalidade: 'b2b', tipo: 'coletiva', perfil: 'muito_baixo' }).map((c) => c.id)).toEqual(['c']);
    expect(filtrarCards(cards, { modalidade: 'b2b', tipo: 'todos', perfil: 'todos' })).toHaveLength(3);
  });
});
