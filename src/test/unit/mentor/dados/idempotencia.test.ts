import { describe, expect, it } from 'vitest';
import { criarRegistroDeIntencoes, novaChave } from '@/features/mentor/api/idempotencia';

describe('registro de intencoes', () => {
  it('gera 32 caracteres seguros e distintos', () => {
    const chaves = Array.from({ length: 30 }, novaChave);
    expect(new Set(chaves).size).toBe(30);
    for (const chave of chaves) expect(chave).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('reusa a chave da mesma intencao e separa corpo, metodo e caminho', () => {
    const registro = criarRegistroDeIntencoes();
    const chave = registro.chavePara('POST', '/itens', { titulo: 'A' });
    expect(registro.chavePara('POST', '/itens', { titulo: 'A' })).toBe(chave);
    expect(registro.chavePara('POST', '/itens', { titulo: 'B' })).not.toBe(chave);
    expect(registro.chavePara('PUT', '/itens', { titulo: 'A' })).not.toBe(chave);
    expect(registro.chavePara('POST', '/outros', { titulo: 'A' })).not.toBe(chave);
  });

  it('concluir renova apenas a intencao concluida', () => {
    const registro = criarRegistroDeIntencoes();
    const chave = registro.chavePara('POST', '/itens', undefined);
    const outra = registro.chavePara('POST', '/outros', undefined);
    registro.concluir('POST', '/itens', undefined);
    expect(registro.chavePara('POST', '/itens', undefined)).not.toBe(chave);
    expect(registro.chavePara('POST', '/outros', undefined)).toBe(outra);
  });

  it('vence em dez minutos sem prolongar a validade ao consultar', () => {
    let agora = 0;
    const registro = criarRegistroDeIntencoes({ agora: () => agora });
    const chave = registro.chavePara('POST', '/itens', null);
    agora = 599_999;
    expect(registro.chavePara('POST', '/itens', null)).toBe(chave);
    agora = 600_000;
    expect(registro.chavePara('POST', '/itens', null)).not.toBe(chave);
  });

  it('aceita validade injetada', () => {
    let agora = 0;
    const registro = criarRegistroDeIntencoes({ agora: () => agora, validadeMs: 20 });
    const chave = registro.chavePara('PUT', '/itens', {});
    agora = 20;
    expect(registro.chavePara('PUT', '/itens', {})).not.toBe(chave);
  });

  it('ordena chaves recursivamente, preservando a ordem dos arrays e o JSON enviado', () => {
    const registro = criarRegistroDeIntencoes();
    const chave = registro.chavePara('POST', '/itens', { b: [{ z: 1, a: 2 }], a: 3 });
    expect(registro.chavePara('POST', '/itens', { a: 3, b: [{ a: 2, z: 1 }] })).toBe(chave);
    expect(registro.chavePara('POST', '/itens', { a: 3, b: [{ a: 2, z: 1 }], omitido: undefined })).toBe(chave);
    expect(registro.chavePara('POST', '/itens', [1, 2])).not.toBe(registro.chavePara('POST', '/itens', [2, 1]));
  });
});
