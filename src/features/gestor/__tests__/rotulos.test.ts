import { describe, it, expect } from 'vitest';
import { TRACO, ROTULO_NIVEL, ROTULO_TENDENCIA, rotuloSituacao, rotuloGrupo } from '@/features/gestor/lib/rotulos';

describe('ROTULO_NIVEL — rótulo pt-BR de NivelDesempenho (spec §4.4)', () => {
  it('cobre os três níveis, sem sigla nem tradução literal', () => {
    expect(ROTULO_NIVEL.critico).toBe('Desempenho crítico');
    expect(ROTULO_NIVEL.mediano).toBe('Desempenho mediano');
    expect(ROTULO_NIVEL.excelente).toBe('Excelente desempenho');
  });
});

describe('ROTULO_TENDENCIA — rótulo pt-BR de Tendencia (spec §4.11)', () => {
  it('cobre as quatro direções', () => {
    expect(ROTULO_TENDENCIA.subindo).toBe('Subindo');
    expect(ROTULO_TENDENCIA.descendo).toBe('Descendo');
    expect(ROTULO_TENDENCIA.alternando).toBe('Alternando');
    expect(ROTULO_TENDENCIA.estavel).toBe('Estável');
  });
});

describe('rotuloSituacao e rotuloGrupo — mesma fonte usada por formatters.ts (reexportadas para compatibilidade)', () => {
  it('rotuloSituacao cobre os quatro estados', () => {
    expect(rotuloSituacao('proficiente')).toBe('Proficiente');
    expect(rotuloSituacao('abaixo_do_limiar')).toBe('Abaixo do limiar');
    expect(rotuloSituacao('aguardando_resultado')).toBe('Aguardando resultado');
    expect(rotuloSituacao('nao_participou')).toBe('Não participou');
  });

  it('rotuloGrupo devolve TRACO para grupo null (achado 4 da revisão de 03/08)', () => {
    expect(rotuloGrupo(null)).toBe(TRACO);
    expect(rotuloGrupo('em_variacao')).toBe('Em variação');
  });
});
