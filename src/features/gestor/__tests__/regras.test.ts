import { describe, it, expect } from 'vitest';
import {
  PROFICIENCIA_MINIMA,
  NIVEL_CRITICO_MAX,
  NIVEL_EXCELENTE_MIN,
  ehProficiente,
  nivelDesempenho,
  grupoEvolucao,
  calcularVariacao,
  tendencia,
} from '@/features/gestor/lib/regras';

describe('constantes da régua canônica (spec §4.3, §4.4)', () => {
  it('fixa os três cortes oficiais', () => {
    expect(PROFICIENCIA_MINIMA).toBe(60);
    expect(NIVEL_CRITICO_MAX).toBe(30);
    expect(NIVEL_EXCELENTE_MIN).toBe(80);
  });
});

describe('ehProficiente — corte >= 60 (spec §4.3, caso de teste crítico nº1)', () => {
  it('59.9 NÃO é proficiente', () => {
    expect(ehProficiente(59.9)).toBe(false);
  });

  it('60 É proficiente — o handoff está errado ao dizer que não é', () => {
    expect(ehProficiente(60)).toBe(true);
  });

  it('60.1 é proficiente', () => {
    expect(ehProficiente(60.1)).toBe(true);
  });

  it('null não é proficiente (ausência não vira zero — spec §4.10)', () => {
    expect(ehProficiente(null)).toBe(false);
  });

  it('extremos da escala', () => {
    expect(ehProficiente(0)).toBe(false);
    expect(ehProficiente(100)).toBe(true);
  });
});

describe('nivelDesempenho — 3 níveis sobre % de acerto (spec §4.4)', () => {
  it('null devolve null, nunca crítico', () => {
    expect(nivelDesempenho(null)).toBeNull();
  });

  it('29.9 é crítico', () => {
    expect(nivelDesempenho(29.9)).toBe('critico');
  });

  it('30 é mediano — a borda pertence ao mediano', () => {
    expect(nivelDesempenho(30)).toBe('mediano');
  });

  it('50 é mediano — o corte é 30, não 50 (determinação de produto de 28/07)', () => {
    expect(nivelDesempenho(50)).toBe('mediano');
  });

  it('79.9 é mediano', () => {
    expect(nivelDesempenho(79.9)).toBe('mediano');
  });

  it('80 é excelente — a borda pertence ao excelente', () => {
    expect(nivelDesempenho(80)).toBe('excelente');
  });

  it('extremos da escala', () => {
    expect(nivelDesempenho(0)).toBe('critico');
    expect(nivelDesempenho(100)).toBe('excelente');
  });
});

describe('calcularVariacao (spec §4.10)', () => {
  it('devolve a diferença quando os dois lados existem', () => {
    expect(calcularVariacao(58, 61)).toBe(3);
    expect(calcularVariacao(61, 58)).toBe(-3);
    expect(calcularVariacao(60, 60)).toBe(0);
  });

  it('devolve null quando o anterior é null', () => {
    expect(calcularVariacao(null, 61)).toBeNull();
  });

  it('devolve null quando o atual é null', () => {
    expect(calcularVariacao(58, null)).toBeNull();
  });

  it('devolve null quando os dois são null', () => {
    expect(calcularVariacao(null, null)).toBeNull();
  });

  it('não devolve ruído de ponto flutuante', () => {
    expect(calcularVariacao(59.9, 62.5)).toBe(2.6);
  });
});

describe('grupoEvolucao (spec §4.8)', () => {
  it('série toda proficiente => consistentemente_proficiente', () => {
    expect(grupoEvolucao([60, 72, 88])).toBe('consistentemente_proficiente');
  });

  it('série toda não proficiente => consistentemente_nao_proficiente', () => {
    expect(grupoEvolucao([12, 40, 59.9])).toBe('consistentemente_nao_proficiente');
  });

  it('série alternando => em_variacao', () => {
    expect(grupoEvolucao([45, 71, 52])).toBe('em_variacao');
  });

  it('ignora null e classifica pelos pontos existentes', () => {
    expect(grupoEvolucao([null, 72, null, 88])).toBe('consistentemente_proficiente');
    expect(grupoEvolucao([null, 41, null])).toBe('consistentemente_nao_proficiente');
    expect(grupoEvolucao([null, 41, 91])).toBe('em_variacao');
  });

  it('devolve null quando não há nenhum ponto utilizável', () => {
    expect(grupoEvolucao([])).toBeNull();
    expect(grupoEvolucao([null, null])).toBeNull();
  });

  it('um único ponto ainda classifica — não força em_variacao', () => {
    expect(grupoEvolucao([61])).toBe('consistentemente_proficiente');
    expect(grupoEvolucao([59])).toBe('consistentemente_nao_proficiente');
  });
});

describe('tendencia (spec §4.11 — representa a janela toda)', () => {
  it('monotônica crescente => subindo', () => {
    expect(tendencia([40, 55, 70])).toBe('subindo');
  });

  it('monotônica decrescente => descendo', () => {
    expect(tendencia([70, 55, 40])).toBe('descendo');
  });

  it('sobe e desce => alternando', () => {
    expect(tendencia([40, 70, 55])).toBe('alternando');
    expect(tendencia([70, 40, 65])).toBe('alternando');
  });

  it('valores repetidos => estavel', () => {
    expect(tendencia([60, 60, 60])).toBe('estavel');
  });

  it('platô com um único sentido segue o sentido', () => {
    expect(tendencia([40, 40, 55])).toBe('subindo');
    expect(tendencia([55, 40, 40])).toBe('descendo');
  });

  it('menos de dois pontos utilizáveis => estavel', () => {
    expect(tendencia([])).toBe('estavel');
    expect(tendencia([61])).toBe('estavel');
    expect(tendencia([null, 61, null])).toBe('estavel');
  });

  it('null é buraco na série, não queda', () => {
    expect(tendencia([40, null, 70])).toBe('subindo');
    expect(tendencia([70, null, 40])).toBe('descendo');
  });
});
