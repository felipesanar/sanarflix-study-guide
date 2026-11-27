import { describe, expect, it } from 'vitest';
import { duvidasAbertas, identificacaoEfetiva, montarLinhas, respostasEfetivas, situacoes } from '../linhas';
import { pagina } from './fixtures';

describe('leitura → linhas da importação', () => {
  it('página identificada e sem dúvida vira uma linha com todas as questões', () => {
    const pg = pagina({ identificacao: '2023001' });
    const m = montarLinhas([pg], 3);
    expect(m.linhas).toEqual([{ pagina: pg.pagina, matricula_ra: '2023001', answers: { '1': 'A', '2': 'B', '3': null } }]);
    expect(m.bloqueada).toBe(false);
    expect(m.contagem.pronta).toBe(1);
  });

  it('resposta decidida na revisão vale mais que a lida (null = em branco)', () => {
    const pg = pagina({ duvidas: { '3': 'multipla' }, respostas_manual: { '3': 'C', '2': null } });
    expect(respostasEfetivas(pg, 3)).toEqual({ '1': 'A', '2': null, '3': 'C' });
    expect(duvidasAbertas(pg)).toEqual([]);
  });

  it('dúvida aberta não bloqueia: entra em branco', () => {
    const pg = pagina({ duvidas: { '3': 'ambigua', '1': 'multipla' }, respostas_manual: { '1': 'A' } });
    expect(duvidasAbertas(pg)).toEqual(['3']);
    const m = montarLinhas([pg], 3);
    expect(m.contagem.com_duvida).toBe(1);
    expect(m.bloqueada).toBe(false);
    expect(m.linhas).toHaveLength(1);
  });

  it('cartão genérico bloqueia até alguém confirmar a matrícula', () => {
    const pg = pagina({ destino: 'nao_identificados', identificacao: null, via: null, motivo: 'cartao_generico' });
    expect(montarLinhas([pg], 3)).toMatchObject({ bloqueada: true, linhas: [] });
    const ok = { ...pg, identificacao_manual: ' 2024999 ' };
    expect(identificacaoEfetiva(ok)).toBe('2024999');
    expect(montarLinhas([ok], 3)).toMatchObject({ bloqueada: false, linhas: [{ matricula_ra: '2024999' }] });
  });

  it('aluno duplicado do leitor também precisa de confirmação (a identificação lida não basta)', () => {
    const pg = pagina({ destino: 'nao_identificados', identificacao: '2023001', motivo: 'aluno_duplicado' });
    expect(identificacaoEfetiva(pg)).toBe('');
    expect(montarLinhas([pg], 3).bloqueada).toBe(true);
  });

  it('a mesma identificação em duas páginas bloqueia até descartar uma (sem diferenciar caixa)', () => {
    const a = pagina({ identificacao: 'ABC1' });
    const b = pagina({ destino: 'nao_identificados', identificacao: null, identificacao_manual: 'abc1' });
    expect(situacoes([a, b])).toEqual(new Map([[a.id, 'duplicada'], [b.id, 'duplicada']]));
    expect(montarLinhas([a, b], 3).bloqueada).toBe(true);
    const m = montarLinhas([a, { ...b, descartada: true }], 3);
    expect(m.bloqueada).toBe(false);
    expect(m.linhas.map((l) => l.matricula_ra)).toEqual(['ABC1']);
  });

  it('ignoradas e descartadas ficam de fora, e a identificação manual corrige a lida', () => {
    const branco = pagina({ destino: 'ignorada', status: 'pagina_em_branco', identificacao: null });
    const descartada = pagina({ descartada: true });
    const corrigida = pagina({ identificacao: '111', identificacao_manual: '222' });
    const m = montarLinhas([branco, descartada, corrigida], 3);
    expect(m.linhas.map((l) => l.matricula_ra)).toEqual(['222']);
    expect(m.contagem).toMatchObject({ ignorada: 1, descartada: 1, pronta: 1 });
  });

  it('linhas saem na ordem das páginas', () => {
    const p2 = pagina();
    const p1 = { ...pagina(), pagina: 0 };
    expect(montarLinhas([p2, p1], 3).linhas.map((l) => l.pagina)).toEqual([0, p2.pagina]);
  });
});
