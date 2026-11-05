import { afterEach, describe, expect, it } from 'vitest';
import { _resetarFontes, dadosAtivos, escolherFonte, fonteAtiva, modalidadeMock } from '@/features/mentor/api/ativa';

afterEach(() => _resetarFontes());

describe('escolha da fonte pela env (mock > flix > academy)', () => {
  it('padrão é academy', () => {
    expect(escolherFonte({})).toBe('academy');
    expect(escolherFonte({ fonte: '', flix: false })).toBe('academy');
    expect(escolherFonte({ fonte: 'academy' })).toBe('academy');
  });

  it('VITE_FLIX_MENTORIA=on liga o Flix', () => {
    expect(escolherFonte({ flix: true })).toBe('flix');
    expect(escolherFonte({ fonte: 'flix' })).toBe('flix');
  });

  it('VITE_MENTOR_FONTE=mock vence o Flix', () => {
    expect(escolherFonte({ fonte: 'mock', flix: true })).toBe('mock');
    expect(escolherFonte({ fonte: ' MOCK ' })).toBe('mock');
  });

  it('mock nunca roda em produção: cai para a próxima fonte', () => {
    expect(escolherFonte({ fonte: 'mock', producao: true })).toBe('academy');
    expect(escolherFonte({ fonte: 'mock', flix: true, producao: true })).toBe('flix');
  });

  it('modalidade do mock: b2c por padrão, b2b quando pedido', () => {
    expect(modalidadeMock({})).toBe('b2c');
    expect(modalidadeMock({ modalidade: 'b2b' })).toBe('b2b');
    expect(modalidadeMock({ modalidade: 'xyz' })).toBe('b2c');
  });
});

describe('fonteAtiva / dadosAtivos', () => {
  it('devolve a implementação certa, com instância estável', () => {
    expect(fonteAtiva({}).nome).toBe('academy');
    expect(fonteAtiva({ flix: true }).nome).toBe('flix');
    expect(fonteAtiva({ flix: true }).eventosNoServidor).toBe(false);
    expect(fonteAtiva({ fonte: 'mock' }).nome).toBe('mock');
    expect(fonteAtiva({})).toBe(fonteAtiva({}));
  });

  it('no mock, DAG e kanban também vêm do mock; nas outras, do Academy', async () => {
    const mock = dadosAtivos({ fonte: 'mock', modalidade: 'b2c' });
    expect(mock).not.toBe(dadosAtivos({}));
    expect(dadosAtivos({ flix: true })).toBe(dadosAtivos({}));
  });
});
