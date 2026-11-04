import { describe, it, expect } from 'vitest';
import { ehLinkHttp, ehLinkHttps } from '@/features/mentor/lib/linkSeguro';
import { ehLinkHttps as ehLinkHttpsSessoes, ehLinkSeguro } from '@/features/mentor/components/sessoes/dataHora';
import { validarFormulario, formularioVazio } from '@/features/mentor/components/mural/muralUtils';
import { formatPct as formatPctDetalhamento } from '@/features/mentor/components/detalhamento/util';
import { formatPct as formatPctTurma } from '@/features/mentor/components/turma/simulados';

describe('ehLinkHttps', () => {
  it('aceita https com host, ignorando espaços nas pontas', () => {
    expect(ehLinkHttps('https://meet.google.com/abc')).toBe(true);
    expect(ehLinkHttps('  https://meet.google.com/abc  ')).toBe(true);
    expect(ehLinkHttps('HTTPS://Exemplo.com/x?y=1#z')).toBe(true);
  });
  it('recusa http, esquemas perigosos e texto solto', () => {
    expect(ehLinkHttps('http://exemplo.com')).toBe(false);
    expect(ehLinkHttps('javascript:alert(1)')).toBe(false);
    expect(ehLinkHttps('  javascript:alert(1)')).toBe(false);
    expect(ehLinkHttps('data:text/html,<b>x</b>')).toBe(false);
    expect(ehLinkHttps('meet.google.com/abc')).toBe(false);
  });
  it('recusa https sem host, vazio e espaços', () => {
    expect(ehLinkHttps('https://')).toBe(false);
    expect(ehLinkHttps('')).toBe(false);
    expect(ehLinkHttps('   ')).toBe(false);
    expect(ehLinkHttps('https://exemplo.com/a b')).toBe(false);
    expect(ehLinkHttps('https://exemplo .com')).toBe(false);
  });
  it('recusa o que não é string', () => {
    expect(ehLinkHttps(null)).toBe(false);
    expect(ehLinkHttps(undefined)).toBe(false);
    expect(ehLinkHttps(42)).toBe(false);
    expect(ehLinkHttps({})).toBe(false);
  });
  it('os nomes antigos são a mesma função (https apenas)', () => {
    expect(ehLinkHttp).toBe(ehLinkHttps);
    expect(ehLinkHttpsSessoes).toBe(ehLinkHttps);
    expect(ehLinkSeguro).toBe(ehLinkHttps);
    expect(ehLinkSeguro('http://exemplo.com')).toBe(false);
  });
});

describe('Mural: validação do link', () => {
  const base = { ...formularioVazio(), tag: 'Aviso', titulo: 't', mensagem: 'm', linkTitulo: 'l' };
  const erros = (linkUrl: string) => validarFormulario({ ...base, linkUrl });
  it('aceita https e recusa http, https vazio e URL com espaço no meio', () => {
    expect(erros('https://exemplo.com/a')).toEqual([]);
    expect(erros('http://exemplo.com')).toContain('Use um link https://');
    expect(erros('https://')).toContain('Use um link https://');
    expect(erros('https://exemplo.com/a b')).toContain('Use um link https://');
  });
});

describe('formatPct', () => {
  it('é a mesma implementação nos dois módulos', () => {
    expect(formatPctTurma).toBe(formatPctDetalhamento);
  });
  it('formata números e devolve "–" sem valor', () => {
    expect(formatPctTurma(61)).toBe('61%');
    expect(formatPctTurma(61.5)).toBe('61,5%');
    expect(formatPctTurma(0)).toBe('0%');
    expect(formatPctTurma(null)).toBe('–');
    expect(formatPctTurma(undefined)).toBe('–');
    expect(formatPctTurma(Number.NaN)).toBe('–');
  });
});
