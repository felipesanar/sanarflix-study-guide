import { describe, expect, it } from 'vitest';
import golden from './qr-golden.json';
import { encodeQr, qrVersion } from '../qr.ts';
import { buildPayload, isUuid, normalizarMatricula, parseQr, problemaDaMatricula, rotuloDoCartao, sim8 } from '../payload.ts';

interface Caso {
  text: string;
  version: number;
  rows: string[];
}

function paraTexto(m: boolean[][]): string[] {
  return m.map((r) => r.map((v) => (v ? '1' : '0')).join(''));
}

describe('encodeQr (referência: segno, nível Q)', () => {
  const casos = golden.casos as Caso[];

  it('há casos de várias versões e dos dois modos', () => {
    expect(casos.length).toBeGreaterThanOrEqual(80);
    const versoes = new Set(casos.map((c) => c.version));
    for (const v of [1, 2, 3, 4, 5, 6, 7, 8, 9]) expect(versoes.has(v)).toBe(true);
  });

  it.each(casos.map((c, i) => [i, c.text.length, c.version, c] as const))(
    'caso %i (%i caracteres, versão %i) é idêntico ao do segno',
    (_i, _len, version, caso) => {
      const m = encodeQr(caso.text);
      expect(qrVersion(m)).toBe(version);
      expect(paraTexto(m)).toEqual(caso.rows);
    },
  );

  it('recusa texto grande demais para a versão 9', () => {
    expect(() => encodeQr('A'.repeat(200))).toThrow(/longo demais/);
  });
});

describe('payload SFA2 (referência: models.py)', () => {
  const payloads = golden.payloads as Array<{
    model: 'personalizado' | 'uniatenas';
    simulado_id: string;
    matricula: string | null;
    sim8: string;
    payload: string;
  }>;

  it.each(payloads.map((p, i) => [i, p] as const))('payload %i igual ao do Python', (_i, p) => {
    expect(sim8(p.simulado_id)).toBe(p.sim8);
    const spec = { model: p.model, simuladoId: p.simulado_id, ...(p.matricula ? { matricula: p.matricula } : {}) };
    expect(buildPayload(spec)).toBe(p.payload);
  });

  it('ida e volta devolve a matrícula normalizada', () => {
    const sim = '9d6c1f0e-0a5b-4c3a-8d2e-123456789abc';
    const texto = buildPayload({ model: 'personalizado', simuladoId: sim, matricula: ' 99-g-12345 ' });
    expect(texto).toBe('SFA2:M:9D6C1F0E:99-G-12345');
    expect(parseQr(texto)).toEqual({ kind: 'M', sim8: '9D6C1F0E', matricula: '99-G-12345' });
    expect(parseQr('SFA2:A:9D6C1F0E')).toEqual({ kind: 'A', sim8: '9D6C1F0E', matricula: null });
  });

  it.each([
    '',
    'SFA1|sfa|x|G',
    'SFA2:M:9D6C1F0E',
    'SFA2:M:9D6C1F0E:',
    'SFA2:A:9D6C1F0E:EXTRA',
    'SFA2:X:9D6C1F0E',
    'sfa2:a:9d6c1f0e',
    'SFA2:M:9D6C1F0G:123',
    'SFA2:M:9D6C1F0E:ab',
    'SFA2:M:9D6C1F0E:12 34',
    'SFA2:S:9D6C1F0E:7F3A9C215B1E4F0A9C3D0123456789AB',
  ])('parseQr recusa %j', (texto) => {
    expect(parseQr(texto)).toBeNull();
  });

  it('o pior caso (24 caracteres) cabe no QR de versão 3', () => {
    const texto = buildPayload({ model: 'personalizado', simuladoId: '9d6c1f0e-0a5b-4c3a-8d2e-123456789abc', matricula: 'A'.repeat(24) });
    expect(encodeQr(texto).length).toBe(29); // versão 3: 29 x 29 módulos
  });

  it('simulado que não é UUID é recusado', () => {
    for (const sim of ['sim-1', 'a|b', '']) {
      expect(() => buildPayload({ model: 'personalizado', simuladoId: sim, matricula: '123' })).toThrow(/UUID/);
    }
  });

  it.each([
    ['', 'sem_matricula'],
    ['   ', 'sem_matricula'],
    ['12 34', 'formato_nao_suportado'],
    ['12:34', 'formato_nao_suportado'],
    ['Ç1', 'formato_nao_suportado'],
    ['1'.repeat(25), 'formato_nao_suportado'],
  ])('matrícula %j não pode ser impressa (%s)', (mat, motivo) => {
    expect(problemaDaMatricula(mat)).toBe(motivo);
    expect(() => buildPayload({ model: 'personalizado', simuladoId: '9d6c1f0e-0a5b-4c3a-8d2e-123456789abc', matricula: mat })).toThrow(motivo);
  });

  it('isUuid, normalização e rótulo', () => {
    expect(isUuid(' 7F3A9C21-5B1E-4F0A-9C3D-0123456789AB ')).toBe(true);
    expect(isUuid('7f3a9c215b1e4f0a9c3d0123456789ab')).toBe(true);
    expect(isUuid('7f3a9c21-5b1e-4f0a-9c3d')).toBe(false);
    expect(normalizarMatricula(null)).toBe('');
    expect(problemaDaMatricula('99-G-12345')).toBeNull();
    expect(rotuloDoCartao('personalizado', ' ab-1 ')).toBe('AB-1');
    expect(rotuloDoCartao('uniatenas')).toBe('UNIATENAS');
  });
});
