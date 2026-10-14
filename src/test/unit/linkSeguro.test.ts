import { describe, it, expect } from 'vitest';
import { ehLinkHttp } from '@/features/mentor/lib/linkSeguro';

describe('ehLinkHttp', () => {
  it('aceita http e https, ignorando espaços nas pontas', () => {
    expect(ehLinkHttp('https://meet.google.com/abc')).toBe(true);
    expect(ehLinkHttp('http://exemplo.com')).toBe(true);
    expect(ehLinkHttp('  https://meet.google.com/abc  ')).toBe(true);
  });

  it('rejeita outros esquemas, vazio e nulo', () => {
    expect(ehLinkHttp('javascript:alert(1)')).toBe(false);
    expect(ehLinkHttp('  javascript:alert(1)')).toBe(false);
    expect(ehLinkHttp('data:text/html,<b>x</b>')).toBe(false);
    expect(ehLinkHttp('meet.google.com/abc')).toBe(false);
    expect(ehLinkHttp('')).toBe(false);
    expect(ehLinkHttp(null)).toBe(false);
    expect(ehLinkHttp(undefined)).toBe(false);
  });
});
