import { expect, it } from 'vitest';
import { identidadeTribo, temaTribo, temaIes, temaIesPadrao, temaUniAtenas } from './contexto';

it.each([
  ['carcara', '#D9771F', '#3A1405', '#FFB547', 'Nota 90+'],
  ['camaleao', '#1F9D6B', '#0B3B2C', '#5CF2B5', 'Faculdade e ENAMED em sincronia'],
  ['colmeia', '#E0A526', '#3B2A05', '#FFE08A', 'Constância e hábito'],
  ['octopus', '#3B3FB8', '#0D0F33', '#8FA8FF', 'Pouco tempo, muito foco'],
] as const)('fallback da tribo %s segue docs/01', (id, sig, shadow, glow, lema) => {
  expect(identidadeTribo(id)).toMatchObject({ cores: { sig, shadow, glow }, lema });
  expect(temaTribo(id).faixa).toContain(`${sig}73`);
  expect(temaTribo(id).cartaoSidebar).toBe(shadow);
  expect(temaTribo(id).destaque).toBe(glow);
});

it('cadastro da tribo prevalece e não altera o fallback', () => {
  const cadastro = { lema: 'Lema cadastrado', cores: { sig: '#123456', shadow: '#111111', glow: '#eeeeee' } };
  expect(identidadeTribo('carcara', cadastro).lema).toBe('Lema cadastrado');
  expect(temaTribo('carcara', cadastro).faixa).toContain('#12345673');
  expect(temaTribo('carcara').faixa).toContain('#D9771F73');
});

it('IES sem cadastro usa tokens do Academy e aceita identidade parcial ou completa', () => {
  expect(temaIes()).toMatchObject(temaIesPadrao);
  expect(temaIes().faixa).toBe('var(--gp-surface-1)');
  expect(temaIes({ fundo: '#123456', acento: '#abcdef', acentoHover: '#fedcba', selo: '/selo.svg', logo: '/logo.svg' })).toMatchObject({ faixa: '#123456', acao: { fundo: '#abcdef', fundoHover: '#fedcba' }, selo: '/selo.svg', logo: '/logo.svg' });
  expect(temaIes({ acento: '#123456' }).acao.fundoHover).toBe(temaIesPadrao.acao.fundoHover);
  expect(temaUniAtenas.acao.fundo).toBe('#F8941C');
});
