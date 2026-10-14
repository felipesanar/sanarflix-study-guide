import { describe, it, expect } from 'vitest';
import { parseEmailsParam } from '@/features/mentor/lib/emailsParam';

describe('parseEmailsParam', () => {
  it('um e-mail simples continua funcionando', () => {
    expect(parseEmailsParam('ana@x.com')).toEqual(['ana@x.com']);
  });

  it('divide por vírgula, aplica trim e minúsculas, remove vazios e duplicados (ordem preservada)', () => {
    expect(parseEmailsParam(' Ana@X.com, bia@x.com ,,ANA@x.com,  ,cris@x.com')).toEqual([
      'ana@x.com',
      'bia@x.com',
      'cris@x.com',
    ]);
  });

  it('ignora o que não tem formato de e-mail', () => {
    expect(parseEmailsParam('ana@x.com,<script>,javascript:alert(1),a b@x.com,@x.com,x@y')).toEqual(['ana@x.com']);
  });

  it('junta vários parâmetros e tolera nulos', () => {
    expect(parseEmailsParam(null, 'ana@x.com', undefined, 'bia@x.com,ana@x.com', '')).toEqual([
      'ana@x.com',
      'bia@x.com',
    ]);
    expect(parseEmailsParam(null)).toEqual([]);
  });
});
