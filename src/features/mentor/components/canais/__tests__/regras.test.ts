import { describe, expect, it } from 'vitest';
import type { ItemRotinaAcademy, Perola } from '@/features/mentor/api/types';
import {
  dataDoDia,
  ddmm,
  intervaloSemana,
  linhasRodizio,
  normalizarLinkGrupo,
  podeMarcar,
  rotuloDiaLongo,
  rotuloSituacao,
  situacaoItem,
} from '../regras';

const item = (dia: ItemRotinaAcademy['dia'], enviadoEm: string | null = null): ItemRotinaAcademy => ({
  id: `r-${dia}`, semana: '2026-10-12', dia, tipo: dia === 'ter' ? 'enquete' : dia === 'qui' ? 'resposta' : 'perola', conteudo: '', enviadoEm,
});

describe('rotina da semana', () => {
  it('data de cada dia a partir da segunda-feira', () => {
    expect(dataDoDia('2026-10-12', 'ter')).toBe('2026-10-13');
    expect(dataDoDia('2026-10-12', 'qui')).toBe('2026-10-15');
    expect(dataDoDia('2026-10-12', 'sex')).toBe('2026-10-16');
    expect(ddmm('2026-10-16')).toBe('16/10');
  });

  it('intervalo da semana (segunda a sexta), com e sem virada de mês', () => {
    expect(intervaloSemana('2026-10-12')).toBe('12 a 16/10');
    expect(intervaloSemana('2026-09-28')).toBe('28/09 a 02/10');
  });

  it('situação: enviado, hoje, atrasado, amanhã e futuro', () => {
    expect(situacaoItem(item('ter', '2026-10-13T15:00:00Z'), '2026-10-15')).toBe('enviado');
    expect(situacaoItem(item('qui'), '2026-10-15')).toBe('hoje');
    expect(situacaoItem(item('ter'), '2026-10-15')).toBe('atrasado');
    expect(situacaoItem(item('sex'), '2026-10-15')).toBe('amanha');
    expect(situacaoItem(item('sex'), '2026-10-13')).toBe('futuro');
  });

  it('rótulos do protótipo e "Marcar como enviado" só no dia ou depois', () => {
    expect(rotuloSituacao('enviado', 'ter')).toBe('Enviado');
    expect(rotuloSituacao('hoje', 'qui')).toBe('Pendente · hoje');
    expect(rotuloSituacao('amanha', 'sex')).toBe('Amanhã');
    expect(rotuloSituacao('atrasado', 'ter')).toBe('Pendente');
    expect(rotuloSituacao('futuro', 'sex')).toBe('Na sexta');
    expect(podeMarcar('hoje')).toBe(true);
    expect(podeMarcar('atrasado')).toBe(true);
    expect(podeMarcar('amanha')).toBe(false);
    expect(podeMarcar('enviado')).toBe(false);
  });

  it('dia longo: "Quinta, 15/10 · hoje"', () => {
    expect(rotuloDiaLongo(item('qui'), 'hoje')).toBe('Quinta, 15/10 · hoje');
    expect(rotuloDiaLongo(item('ter'), 'enviado')).toBe('Terça, 13/10');
  });
});

describe('link do grupo', () => {
  it('aceita convite do WhatsApp com ou sem https', () => {
    expect(normalizarLinkGrupo('chat.whatsapp.com/Kc8tRbQ2xLm')).toBe('https://chat.whatsapp.com/Kc8tRbQ2xLm');
    expect(normalizarLinkGrupo(' https://chat.whatsapp.com/abc ')).toBe('https://chat.whatsapp.com/abc');
  });
  it('recusa outro domínio, http e convite vazio', () => {
    expect(normalizarLinkGrupo('https://wa.me/5511999')).toBeNull();
    expect(normalizarLinkGrupo('http://chat.whatsapp.com/abc')).toBeNull();
    expect(normalizarLinkGrupo('https://chat.whatsapp.com/')).toBeNull();
    expect(normalizarLinkGrupo('javascript:alert(1)')).toBeNull();
  });
});

describe('rodízio do banco de pérolas', () => {
  const p = (semana: string, mentor: string, data: string, tema: string): Perola => ({
    id: `p${semana}`, texto: `Semana ${semana} · ${mentor} · no mural em ${data}`, tema, criadaEm: '2026-10-01T00:00:00Z',
  });
  const perolas = [p('2', 'Beatriz Câmara', '26/10', 'GO'), p('1', 'Ana Carolina', '19/10', 'MFC'), p('3', 'Julia Mendonça', '02/11', 'Dermato')];

  it('ordena por semana, marca "(você)", "Sua vez · propor até" e "Próxima no mural"', () => {
    const linhas = linhasRodizio(perolas, 'Beatriz Camara', '2026-10-15');
    expect(linhas.map((l) => l.semana)).toEqual(['1', '2', '3']);
    expect(linhas[0]).toMatchObject({ mentor: 'Ana Carolina', ehVoce: false, situacao: 'Próxima no mural' });
    expect(linhas[1]).toMatchObject({ mentor: 'Beatriz Câmara', ehVoce: true, situacao: 'Sua vez · propor até 23/10', noMuralEm: '26/10' });
    expect(linhas[2].situacao).toBeNull();
  });

  it('pérola fora do rodízio não inventa semana, mentor nem data', () => {
    const [l] = linhasRodizio([{ id: 'x', texto: 'ECG com QRS largo', tema: null, criadaEm: '2026-10-01T00:00:00Z' }], 'Beatriz Câmara', '2026-10-15');
    expect(l).toMatchObject({ semana: null, mentor: null, noMuralEm: null, tema: 'ECG com QRS largo', ehVoce: false, situacao: null });
  });

  it('virada de ano: 05/01 em dezembro é janeiro seguinte', () => {
    const linhas = linhasRodizio([p('12', 'Ana Carolina', '05/01', 'MFC')], 'Outra', '2026-12-20');
    expect(linhas[0].situacao).toBe('Próxima no mural');
  });
});
