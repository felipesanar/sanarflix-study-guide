import { describe, expect, it } from 'vitest';
import golden from './qr-golden.json';
import { encodeQr, qrVersion } from '../qr.ts';
import { buildPayload, isUuid, parseQr, rotuloDoCartao, sim8 } from '../payload.ts';

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
    user_id: string | null;
    sim8: string;
    payload: string;
  }>;

  it.each(payloads.map((p, i) => [i, p] as const))('payload %i igual ao do Python', (_i, p) => {
    expect(sim8(p.simulado_id)).toBe(p.sim8);
    const spec = { model: p.model, simuladoId: p.simulado_id, ...(p.user_id ? { userId: p.user_id } : {}) };
    expect(buildPayload(spec)).toBe(p.payload);
  });

  it('ida e volta devolve o user_id com hífens e em minúsculas', () => {
    const uid = '7f3a9c21-5b1e-4f0a-9c3d-0123456789ab';
    const sim = '9d6c1f0e-0a5b-4c3a-8d2e-123456789abc';
    const texto = buildPayload({ model: 'personalizado', simuladoId: sim, userId: uid.toUpperCase() });
    expect(texto).toBe('SFA2:S:9D6C1F0E:7F3A9C215B1E4F0A9C3D0123456789AB');
    expect(parseQr(texto)).toEqual({ kind: 'S', sim8: '9D6C1F0E', userId: uid });
    expect(parseQr('SFA2:A:9D6C1F0E')).toEqual({ kind: 'A', sim8: '9D6C1F0E', userId: null });
  });

  it.each([
    '',
    'SFA1|sfa|x|G',
    'SFA2:S:9D6C1F0E',
    'SFA2:S:9D6C1F0E:7F3A',
    'SFA2:A:9D6C1F0E:EXTRA',
    'SFA2:X:9D6C1F0E',
    'sfa2:a:9d6c1f0e',
    'SFA2:S:9D6C1F0G:7F3A9C215B1E4F0A9C3D0123456789AB',
  ])('parseQr recusa %j', (texto) => {
    expect(parseQr(texto)).toBeNull();
  });

  it.each([
    ['sim-1', '7f3a9c21-5b1e-4f0a-9c3d-0123456789ab'],
    ['9d6c1f0e-0a5b-4c3a-8d2e-123456789abc', '123'],
    ['9d6c1f0e-0a5b-4c3a-8d2e-123456789abc', ''],
    ['a|b', '7f3a9c21-5b1e-4f0a-9c3d-0123456789ab'],
  ])('ids que não são UUID são recusados (%j, %j)', (sim, uid) => {
    expect(() => buildPayload({ model: 'personalizado', simuladoId: sim, userId: uid })).toThrow(/UUID/);
  });

  it('isUuid e rótulo', () => {
    expect(isUuid(' 7F3A9C21-5B1E-4F0A-9C3D-0123456789AB ')).toBe(true);
    expect(isUuid('7f3a9c215b1e4f0a9c3d0123456789ab')).toBe(true);
    expect(isUuid('7f3a9c21-5b1e-4f0a-9c3d')).toBe(false);
    expect(rotuloDoCartao('personalizado', '7f3a9c21-5b1e-4f0a-9c3d-0123456789ab')).toBe('7F3A9C21');
    expect(rotuloDoCartao('uniatenas')).toBe('UNIATENAS');
  });
});
