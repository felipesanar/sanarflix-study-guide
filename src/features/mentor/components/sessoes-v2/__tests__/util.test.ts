import { describe, expect, it } from 'vitest';
import type { Sessao } from '@/features/mentor/api/types';
import {
  avisoContrato, cicloContrato, ddmm, diaSemana, iniciais, lerData, lerHora, linkExibido, montarInicio,
  normalizarLink, paraStatus, pautaParaSalvar, podeExcluir, rotuloHora, subtituloB2b, temaReal,
} from '../util';

const HOJE = new Date('2026-10-15T12:00:00-03:00');

function sessao(p: Partial<Sessao> = {}): Sessao {
  return {
    id: 's', tipo: 'oficina', data: '2026-10-22', hora: '20:00', tema: null, alunoId: null, link: null,
    status: 'agendada', gravacaoUrl: null, pauta: [], inicio: '2026-10-22T23:00:00.000Z', ...p,
  };
}

describe('datas e horas', () => {
  it('dia da semana e dd/mm a partir da data de São Paulo', () => {
    expect(diaSemana('2026-10-16')).toBe('Sex');
    // O protótipo B2B escreve "Qua 22/10"; em 2026 o dia 22/10 cai numa quinta (o dia vem do calendário).
    expect(diaSemana('2026-10-22')).toBe('Qui');
    expect(ddmm('2026-10-16')).toBe('16/10');
    expect(diaSemana('')).toBe('—');
  });
  it('hora no formato do protótipo', () => {
    expect(rotuloHora('19:00')).toBe('19h');
    expect(rotuloHora('19:30')).toBe('19h30');
    expect(rotuloHora('')).toBe('—');
  });
  it('lê dd/mm como a próxima ocorrência (nunca no passado)', () => {
    expect(lerData('22/10', HOJE)).toBe('2026-10-22');
    expect(lerData('15/10', HOJE)).toBe('2026-10-15');
    expect(lerData('10/01', HOJE)).toBe('2027-01-10');
    expect(lerData('1/2', HOJE)).toBe('2027-02-01');
    expect(lerData('31/02', HOJE)).toBeNull();
    expect(lerData('32/10', HOJE)).toBeNull();
    expect(lerData('amanhã', HOJE)).toBeNull();
    expect(lerData('', HOJE)).toBeNull();
  });
  it('lê hora em 19h, 19:30, 19h30 e 19', () => {
    expect(lerHora('19h')).toBe('19:00');
    expect(lerHora('19:30')).toBe('19:30');
    expect(lerHora('19h30')).toBe('19:30');
    expect(lerHora('7')).toBe('07:00');
    expect(lerHora('25h')).toBeNull();
    expect(lerHora('19:75')).toBeNull();
    expect(lerHora('noite')).toBeNull();
  });
  it('monta o início em ISO UTC (São Paulo, -03:00)', () => {
    expect(montarInicio('2026-10-22', '20:00')).toBe('2026-10-22T23:00:00.000Z');
  });
});

describe('links', () => {
  it('normaliza link sem protocolo para https e recusa o resto', () => {
    expect(normalizarLink('meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
    expect(normalizarLink(' https://meet.google.com/x ')).toBe('https://meet.google.com/x');
    expect(normalizarLink('http://meet.google.com/x')).toBeNull();
    expect(normalizarLink('javascript:alert(1)')).toBeNull();
    expect(normalizarLink('texto solto')).toBeNull();
    expect(normalizarLink('')).toBeNull();
  });
  it('exibe o link sem o protocolo, como no protótipo', () => {
    expect(linkExibido('https://meet.google.com/kfx-qwbr-tpa')).toBe('meet.google.com/kfx-qwbr-tpa');
  });
});

describe('status e tema', () => {
  it('"Tema a definir" e vazio contam como sem tema', () => {
    expect(temaReal(sessao({ tema: 'Tema a definir' }))).toBeNull();
    expect(temaReal(sessao({ tema: '  ' }))).toBeNull();
    expect(temaReal(sessao({ tema: 'Imunização' }))).toBe('Imunização');
  });
  it('status vem de statusSessao sobre o tema normalizado', () => {
    expect(paraStatus(sessao({ tema: 'Tema a definir' }))).toBe('falta_link_e_pauta');
    expect(paraStatus(sessao({ link: 'https://meet.google.com/x' }))).toBe('pauta_pendente');
    expect(paraStatus(sessao({ tema: 'Oficina', link: null }))).toBe('falta_link');
    expect(paraStatus(sessao({ tipo: 'individual' }))).toBe('agendada');
    expect(paraStatus(sessao({ status: 'realizada' }))).toBe('realizada');
  });
  it('só sessão futura e agendada pode ser excluída', () => {
    expect(podeExcluir(sessao(), HOJE)).toBe(true);
    expect(podeExcluir(sessao({ inicio: '2026-10-14T23:00:00.000Z' }), HOJE)).toBe(false);
    expect(podeExcluir(sessao({ status: 'realizada' }), HOJE)).toBe(false);
    expect(podeExcluir(sessao({ inicio: undefined }), HOJE)).toBe(false);
  });
});

describe('subtítulo B2B', () => {
  it('usa a descrição quando existe', () => {
    expect(subtituloB2b(sessao({ descricao: 'pauta gerada do Detalhamento' }), null, false)).toBe('pauta gerada do Detalhamento');
  });
  it('oficina: formato ou escolha a partir dos temas críticos', () => {
    expect(subtituloB2b(sessao({ tema: 'Oficina X' }), null, false)).toBe('5 pré-teste → comentário → ficha → 5 pós');
    expect(subtituloB2b(sessao(), null, false)).toBe('escolha a partir dos temas críticos');
  });
  it('pós-simulado: pauta do Detalhamento ou a sugestão do formato', () => {
    expect(subtituloB2b(sessao({ tipo: 'pos_simulado', pauta: [{ id: 'p', origem: 'mais_erradas', referenciaId: 'x', texto: 't' }] }), null, false)).toBe('pauta gerada do Detalhamento');
    expect(subtituloB2b(sessao({ tipo: 'pos_simulado' }), null, false)).toBe('as 20 mais erradas e os distratores');
  });
  it('individual: nome do aluno e agenda liberada', () => {
    expect(subtituloB2b(sessao({ tipo: 'individual' }), 'Bruno Teles', true)).toBe('Bruno Teles · agenda liberada');
    expect(subtituloB2b(sessao({ tipo: 'individual' }), 'Bruno Teles', false)).toBe('Bruno Teles');
    expect(subtituloB2b(sessao({ tipo: 'individual' }), null, false)).toBe('—');
  });
});

describe('contrato', () => {
  const lista = [
    sessao({ id: 'a', tipo: 'pos_simulado', data: '2026-10-08', status: 'realizada' }),
    sessao({ id: 'b', tipo: 'oficina', data: '2026-10-22' }),
    sessao({ id: 'c', tipo: 'individual', data: '2026-10-20' }),
    sessao({ id: 'd', tipo: 'pos_simulado', data: '2026-11-05' }),
    sessao({ id: 'e', tipo: 'oficina', data: '2026-11-19' }),
  ];
  it('ciclo: realizados no mês atual e agendados no próximo', () => {
    expect(cicloContrato(lista, 2, HOJE)).toEqual([
      { chave: 'atual', texto: 'Out: 1 de 2 realizados', completo: false },
      { chave: 'proximo', texto: 'Nov: 2 de 2 agendados', completo: true },
    ]);
  });
  it('ciclo some sem contrato cadastrado (não inventa a meta)', () => {
    expect(cicloContrato(lista, null, HOJE)).toEqual([]);
  });
  it('aviso quando o mês já tem as coletivas do contrato (não bloqueia)', () => {
    expect(avisoContrato(lista, '2026-11-26', 2, 'UniAtenas')).toBe('Já há 2 sessões coletivas neste mês. O contrato da UniAtenas prevê 2; uma terceira não conta no ciclo.');
    expect(avisoContrato(lista, '2026-10-29', 2, 'UniAtenas')).toBe('Já há 2 sessões coletivas neste mês. O contrato da UniAtenas prevê 2; uma terceira não conta no ciclo.');
    expect(avisoContrato(lista, '2026-12-03', 2, 'UniAtenas')).toBeNull();
    expect(avisoContrato(lista, '2026-11-26', null, 'UniAtenas')).toBeNull();
    expect(avisoContrato([...lista, sessao({ id: 'f', data: '2026-11-26' })], '2026-11-27', 2, null)).toBe('Já há 3 sessões coletivas neste mês. O contrato prevê 2; uma quarta não conta no ciclo.');
  });
});

describe('pauta e iniciais', () => {
  it('pauta para salvar renumera a ordem', () => {
    expect(pautaParaSalvar([
      { id: 'x:3', origem: 'tema_critico', referenciaId: 'hep', texto: 'Hepatites' },
      { id: 'x:7', origem: 'livre', referenciaId: null, texto: 'Livre' },
    ])).toEqual([
      { texto: 'Hepatites', origem: 'tema_critico', referenciaId: 'hep', ordem: 0 },
      { texto: 'Livre', origem: 'livre', referenciaId: undefined, ordem: 1 },
    ]);
  });
  it('iniciais: primeiro e último nome', () => {
    expect(iniciais('Diego Pacheco')).toBe('DP');
    expect(iniciais('Marina de Albuquerque')).toBe('MA');
    expect(iniciais('Ana')).toBe('A');
    expect(iniciais('')).toBe('—');
  });
});
