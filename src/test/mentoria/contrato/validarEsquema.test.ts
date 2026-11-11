import { describe, expect, it } from 'vitest';
import { especificacao } from './especificacao';
import { PALAVRAS_SUPORTADAS, palavrasNaoSuportadas, validarEsquema } from './validarEsquema';

const casos: [string, unknown, unknown, unknown][] = [
  ['type string', { type: 'string' }, 'a', 1],
  ['type integer', { type: 'integer' }, 1, 1.5],
  ['type number', { type: 'number' }, 1.5, Infinity],
  ['type boolean', { type: 'boolean' }, false, 'false'],
  ['type array', { type: 'array' }, [], {}],
  ['type object', { type: 'object' }, {}, []],
  ['type null', { type: 'null' }, null, 0],
  ['type lista', { type: ['string', 'null'], minLength: 2 }, null, 0],
  ['enum', { enum: ['a', 'b'] }, 'a', 'c'],
  ['const', { const: { a: 1, b: 2 } }, { b: 2, a: 1 }, { a: 2 }],
  ['required', { required: ['a'] }, { a: null }, {}],
  ['properties', { properties: { a: { type: 'string' } } }, { a: 'ok' }, { a: 1 }],
  ['additionalProperties false', { properties: { a: {} }, additionalProperties: false }, { a: 1 }, { b: 1 }],
  ['additionalProperties schema', { additionalProperties: { type: 'string' } }, { a: 'ok' }, { a: 1 }],
  ['minProperties', { minProperties: 1 }, { a: 1 }, {}],
  ['items', { items: { type: 'string' } }, ['a'], [1]],
  ['minItems', { minItems: 1 }, [1], []],
  ['maxItems', { maxItems: 1 }, [1], [1, 2]],
  ['uniqueItems', { uniqueItems: true }, [{ a: 1 }, { a: 2 }], [{ a: 1, b: 2 }, { b: 2, a: 1 }]],
  ['minLength', { minLength: 2 }, 'ab', 'a'],
  ['maxLength', { maxLength: 2 }, 'ab', 'abc'],
  ['pattern', { pattern: '^https://' }, 'https://a', 'http://a'],
  ['minimum', { minimum: 2 }, 2, 1],
  ['maximum', { maximum: 2 }, 2, 3],
  ['oneOf', { oneOf: [{ type: 'string' }, { type: 'number' }] }, 'a', null],
  ['format uuid', { format: 'uuid' }, '00000000-0000-4000-8000-0000000000a1', 'abc'],
  ['format date', { format: 'date' }, '2024-02-29', '2026-02-29'],
  ['format date-time', { format: 'date-time' }, '2026-11-12T17:00:00Z', '2026-11-12 17:00'],
];
describe('validador do subconjunto JSON Schema', () => {
  it.each(casos)('%s passa e falha', (_, esquema, valido, invalido) => {
    expect(validarEsquema(esquema, valido)).toEqual([]);
    expect(validarEsquema(esquema, invalido).length).toBeGreaterThan(0);
  });
  it('resolve $ref local e aplica tambem palavras irmas', () => {
    const raiz = { components: { schemas: { Texto: { type: 'string' } } } };
    expect(validarEsquema({ $ref: '#/components/schemas/Texto', minLength: 2 }, 'ok', raiz)).toEqual([]);
    expect(validarEsquema({ $ref: '#/components/schemas/Texto' }, 1, raiz)).not.toEqual([]);
    expect(validarEsquema({ $ref: '#/components/schemas/ausente' }, 1, raiz)).not.toEqual([]);
  });
  it('oneOf exige exatamente um ramo', () => expect(validarEsquema({ oneOf: [{ type: 'number' }, { type: 'integer' }] }, 1)).not.toEqual([]));
  it('date-time exige fuso e data real', () => {
    for (const data of ['2026-11-12T17:00:00Z', '2026-11-12T17:00:00-03:00']) expect(validarEsquema({ format: 'date-time' }, data)).toEqual([]);
    for (const data of ['2026-11-12T17:00:00', '2026-11-12 17:00', '2026-02-30T17:00:00Z', '2026-11-12T27:00:00Z']) expect(validarEsquema({ format: 'date-time' }, data)).not.toEqual([]);
  });
  it('informa caminho JSON Pointer e ignora description e formatos desconhecidos', () => {
    expect(validarEsquema({ properties: { publicacao: { properties: { tag: { const: 'aviso' } } } } }, { publicacao: { tag: 'x' } })[0].caminho).toBe('/publicacao/tag');
    expect(validarEsquema({ description: 'qualquer', format: 'email' }, 'x')).toEqual([]);
    expect(validarEsquema({ additionalProperties: true }, { x: 1 })).toEqual([]);
  });
  it('nao ha palavra de schema nao suportada na especificacao', () => {
    expect(PALAVRAS_SUPORTADAS).toContain('$ref');
    expect(palavrasNaoSuportadas(especificacao)).toEqual([]);
    expect(palavrasNaoSuportadas({ components: { schemas: { X: { type: 'object', properties: { titulo: { minLength: 1, tituloDesconhecido: true } }, palavraNova: 1 } } } })).toEqual(['palavraNova', 'tituloDesconhecido']);
  });
});
