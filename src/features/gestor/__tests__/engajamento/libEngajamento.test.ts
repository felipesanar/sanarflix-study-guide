import { describe, it, expect } from 'vitest';
import {
  calcularPeriodo,
  cicloDoSemestre,
  compacto,
  dec1,
  deltaPct,
  deltaPp,
  diaMes,
  formatarAtualizadoEm,
  hojeSaoPaulo,
  mesAno,
  mesCurto,
  mesExtenso,
  normalizarBusca,
  pct1,
  primeiroNome,
  rotuloOpcaoSemestre,
  rotuloPeriodoAnterior,
  rotuloRecencia,
  rotuloSemestreLetivo,
  textoDetalhe,
} from '@/features/gestor/lib/engajamento';

/** Spec 2026-10-22-engajamento §10.3 e §15.2. */

describe('hojeSaoPaulo', () => {
  it('usa o dia-calendário de America/Sao_Paulo, não o de UTC', () => {
    // 01:30 UTC de 23/10 ainda é 22:30 de 22/10 em São Paulo (UTC-3).
    expect(hojeSaoPaulo(new Date('2026-10-23T01:30:00Z'))).toBe('2026-10-22');
    // 03:00 UTC já é 00:00 de 23/10.
    expect(hojeSaoPaulo(new Date('2026-10-23T03:00:00Z'))).toBe('2026-10-23');
  });

  it('sem argumento devolve uma data AAAA-MM-DD', () => {
    expect(hojeSaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('calcularPeriodo (P1, P2)', () => {
  it("'6m' começa no 1º dia do mês de hoje − 5", () => {
    expect(calcularPeriodo('6m', '2026-10-22')).toEqual({ inicio: '2026-05-01', fim: '2026-10-22', opcaoEfetiva: '6m' });
  });

  it("'6m' atravessa a virada do ano", () => {
    expect(calcularPeriodo('6m', '2026-03-01').inicio).toBe('2025-10-01');
    expect(calcularPeriodo('6m', '2026-05-15').inicio).toBe('2025-12-01');
    expect(calcularPeriodo('6m', '2026-06-15').inicio).toBe('2026-01-01');
  });

  it("'30d' = hoje − 29 até hoje, inclusive (30 dias)", () => {
    expect(calcularPeriodo('30d', '2026-10-22')).toEqual({ inicio: '2026-09-23', fim: '2026-10-22', opcaoEfetiva: '30d' });
    expect(calcularPeriodo('30d', '2026-03-01').inicio).toBe('2026-01-31');
    expect(calcularPeriodo('30d', '2026-01-10').inicio).toBe('2025-12-12');
  });

  it("'letivo' vai de 1º/jan (1º semestre) ou 1º/jul (2º semestre) até hoje", () => {
    expect(calcularPeriodo('letivo', '2026-10-22').inicio).toBe('2026-07-01');
    expect(calcularPeriodo('letivo', '2026-06-30').inicio).toBe('2026-01-01');
    expect(calcularPeriodo('letivo', '2026-07-01').inicio).toBe('2026-07-01');
    expect(calcularPeriodo('letivo', '2026-12-31')).toEqual({ inicio: '2026-07-01', fim: '2026-12-31', opcaoEfetiva: 'letivo' });
    expect(calcularPeriodo('letivo', '2026-01-01').inicio).toBe('2026-01-01');
  });

  it("'ano' (admin) vai de 1º/jan até hoje", () => {
    expect(calcularPeriodo('ano', '2026-10-22')).toEqual({ inicio: '2026-01-01', fim: '2026-10-22', opcaoEfetiva: 'ano' });
  });

  it("'custom' válido devolve as datas escolhidas", () => {
    expect(calcularPeriodo('custom', '2026-10-22', '2026-03-01', '2026-04-15')).toEqual({
      inicio: '2026-03-01', fim: '2026-04-15', opcaoEfetiva: 'custom',
    });
  });

  it("'custom' com de > ate cai em '6m'", () => {
    expect(calcularPeriodo('custom', '2026-10-22', '2026-05-10', '2026-05-01')).toEqual({
      inicio: '2026-05-01', fim: '2026-10-22', opcaoEfetiva: '6m',
    });
  });

  it("'custom' fora dos limites cai em '6m': antes de 2025-01-01 ou depois de hoje", () => {
    const seis = { inicio: '2026-05-01', fim: '2026-10-22', opcaoEfetiva: '6m' };
    expect(calcularPeriodo('custom', '2026-10-22', '2024-12-31', '2025-02-01')).toEqual(seis);
    expect(calcularPeriodo('custom', '2026-10-22', '2026-10-01', '2026-10-23')).toEqual(seis);
  });

  it("'custom' respeita o limite de 731 dias (730 de diferença) e o mínimo de 2025-01-01", () => {
    // 2025-01-01 → 2027-01-01 = 730 dias de diferença = 731 dias inclusive: limite exato, válido.
    expect(calcularPeriodo('custom', '2027-01-01', '2025-01-01', '2027-01-01').opcaoEfetiva).toBe('custom');
    // um dia a mais (732 inclusive): inválido, a RPC recusaria com periodo_invalido.
    expect(calcularPeriodo('custom', '2027-01-02', '2025-01-01', '2027-01-02').opcaoEfetiva).toBe('6m');
    // 2025-01-01 → 2026-12-31 = 729 de diferença: válido.
    expect(calcularPeriodo('custom', '2026-12-31', '2025-01-01', '2026-12-31').opcaoEfetiva).toBe('custom');
    // o mínimo é inclusivo.
    expect(calcularPeriodo('custom', '2026-10-22', '2025-01-01', '2025-01-31').opcaoEfetiva).toBe('custom');
    expect(calcularPeriodo('custom', '2026-10-22', null, null).opcaoEfetiva).toBe('6m');
    expect(calcularPeriodo('custom', '2026-10-22', '2026-02-30', '2026-03-10').opcaoEfetiva).toBe('6m');
    expect(calcularPeriodo('custom', '2026-10-22', 'abc', '2026-03-10').opcaoEfetiva).toBe('6m');
  });
});

describe('rotuloSemestreLetivo', () => {
  it('"Semestre letivo AAAA.S" a partir de hoje', () => {
    expect(rotuloSemestreLetivo('2026-10-22')).toBe('Semestre letivo 2026.2');
    expect(rotuloSemestreLetivo('2026-06-30')).toBe('Semestre letivo 2026.1');
    expect(rotuloSemestreLetivo('2026-07-01')).toBe('Semestre letivo 2026.2');
    expect(rotuloSemestreLetivo('2027-01-01')).toBe('Semestre letivo 2027.1');
  });
});

describe('ciclo do semestre (D15)', () => {
  it('1–4 básico, 5–8 clínico, 9–12 internato', () => {
    expect(cicloDoSemestre(1)).toBe('basico');
    expect(cicloDoSemestre(4)).toBe('basico');
    expect(cicloDoSemestre(5)).toBe('clinico');
    expect(cicloDoSemestre(8)).toBe('clinico');
    expect(cicloDoSemestre(9)).toBe('internato');
    expect(cicloDoSemestre(12)).toBe('internato');
  });

  it('rotuloOpcaoSemestre: "8º semestre · clínico"', () => {
    expect(rotuloOpcaoSemestre(8)).toBe('8º semestre · clínico');
    expect(rotuloOpcaoSemestre(1)).toBe('1º semestre · básico');
    expect(rotuloOpcaoSemestre(12)).toBe('12º semestre · internato');
  });
});

describe('rotuloRecencia', () => {
  it('hoje, ontem, há N dias e nunca', () => {
    expect(rotuloRecencia(0)).toBe('hoje');
    expect(rotuloRecencia(1)).toBe('ontem');
    expect(rotuloRecencia(2)).toBe('há 2 dias');
    expect(rotuloRecencia(81)).toBe('há 81 dias');
    expect(rotuloRecencia(null)).toBe('nunca');
  });
});

describe('formatadores de data', () => {
  it('mesAno: "2026-09" → "set/26"', () => {
    expect(mesAno('2026-09')).toBe('set/26');
    expect(mesAno('2026-01')).toBe('jan/26');
    expect(mesAno('2025-12')).toBe('dez/25');
  });

  it('mesCurto: "Set", e "Set*" quando parcial', () => {
    expect(mesCurto('2026-09')).toBe('Set');
    expect(mesCurto('2026-10', true)).toBe('Out*');
    expect(mesCurto('2026-10', false)).toBe('Out');
  });

  it('mesExtenso: "Outubro"', () => {
    expect(mesExtenso('2026-10')).toBe('Outubro');
    expect(mesExtenso('2026-03')).toBe('Março');
  });

  it('diaMes: "22/10"', () => {
    expect(diaMes('2026-10-22')).toBe('22/10');
    expect(diaMes('2026-01-05')).toBe('05/01');
  });
});

describe('primeiroNome', () => {
  it('primeiro token do nome, sem espaços nas pontas', () => {
    expect(primeiroNome('Ana Clara Ribeiro')).toBe('Ana');
    expect(primeiroNome('  Maria  Eduarda ')).toBe('Maria');
    expect(primeiroNome('Valter')).toBe('Valter');
    expect(primeiroNome('')).toBe('');
  });
});

describe('pct1, dec1 e compacto', () => {
  it('pct1: 1 casa e vírgula; null vira traço', () => {
    expect(pct1(56.68)).toBe('56,7%');
    expect(pct1(100)).toBe('100,0%');
    expect(pct1(0)).toBe('0,0%');
    expect(pct1(2.2)).toBe('2,2%');
    expect(pct1(null)).toBe('—');
  });

  it('dec1: 1 casa e vírgula; null vira traço', () => {
    expect(dec1(42.15)).toBe('42,2');
    expect(dec1(9.1)).toBe('9,1');
    expect(dec1(0)).toBe('0,0');
    expect(dec1(null)).toBe('—');
  });

  it('compacto do admin: < 100.000 por extenso, ≥ 100.000 em "mil", ≥ 1.000.000 em "mi"', () => {
    expect(compacto(98765)).toBe('98.765');
    expect(compacto(99999)).toBe('99.999');
    expect(compacto(100000)).toBe('100 mil');
    expect(compacto(261000)).toBe('261 mil');
    expect(compacto(936269)).toBe('936 mil');
    expect(compacto(1300000)).toBe('1,3 mi');
    expect(compacto(0)).toBe('0');
  });
});

describe('deltaPp e deltaPct (D10)', () => {
  it('deltaPp: "▲ 6 p.p.", "▼ 3 p.p.", "= 0 p.p."', () => {
    expect(deltaPp(70, 64)).toBe('▲ 6 p.p.');
    expect(deltaPp(60, 63)).toBe('▼ 3 p.p.');
    expect(deltaPp(63, 63)).toBe('= 0 p.p.');
    expect(deltaPp(63.2, 63)).toBe('= 0 p.p.');
  });

  it('deltaPp com anterior ou atual null não inventa número', () => {
    expect(deltaPp(70, null)).toBeNull();
    expect(deltaPp(null, 60)).toBeNull();
  });

  it('deltaPct: "+14%", "−8%" (sinal de menos) e "0%"', () => {
    expect(deltaPct(114, 100)).toBe('+14%');
    expect(deltaPct(92, 100)).toBe('−8%');
    expect(deltaPct(100, 100)).toBe('0%');
  });

  it('deltaPct com anterior null ou 0 não existe (nunca "+∞%")', () => {
    expect(deltaPct(50, null)).toBeNull();
    expect(deltaPct(50, 0)).toBeNull();
    expect(deltaPct(0, 0)).toBeNull();
  });
});

describe('rotuloPeriodoAnterior', () => {
  it('6m e 30d têm texto próprio; os demais usam o número de dias', () => {
    expect(rotuloPeriodoAnterior('6m', 175)).toBe('6 meses anteriores');
    expect(rotuloPeriodoAnterior('30d', 30)).toBe('30 dias anteriores');
    expect(rotuloPeriodoAnterior('letivo', 114)).toBe('114 dias anteriores');
    expect(rotuloPeriodoAnterior('custom', 45)).toBe('45 dias anteriores');
    expect(rotuloPeriodoAnterior('ano', 295)).toBe('295 dias anteriores');
  });
});

describe('textoDetalhe', () => {
  it('questões com e sem especialidade, vídeo e documento', () => {
    expect(textoDetalhe({ dia: '2026-08-02', tipo: 'questoes', especialidade: 'Cardiologia' })).toBe('02/08 · Questões de Cardiologia');
    expect(textoDetalhe({ dia: '2026-08-02', tipo: 'questoes', especialidade: null })).toBe('02/08 · Questões');
    expect(textoDetalhe({ dia: '2026-08-19', tipo: 'video', especialidade: 'Farmacologia' })).toBe('19/08 · Vídeo de Farmacologia');
    expect(textoDetalhe({ dia: '2026-08-27', tipo: 'documento', especialidade: 'Obstetrícia' })).toBe('27/08 · Documento de Obstetrícia');
  });

  it('sem detalhe: "nenhuma atividade registrada"', () => {
    expect(textoDetalhe(null)).toBe('nenhuma atividade registrada');
  });
});

describe('normalizarBusca', () => {
  it('minúsculo e sem acento', () => {
    expect(normalizarBusca('Conceição João')).toBe('conceicao joao');
    expect(normalizarBusca('ÁÉÍÓÚ Çã')).toBe('aeiou ca');
    expect(normalizarBusca('')).toBe('');
  });
});

describe('formatarAtualizadoEm', () => {
  it('converte o instante UTC para o horário de São Paulo: "dd/mm/aaaa, HH:mm"', () => {
    expect(formatarAtualizadoEm('2026-10-22T09:02:41.5+00:00')).toBe('22/10/2026, 06:02');
    expect(formatarAtualizadoEm('2026-10-26T09:02:34.011434+00:00')).toBe('26/10/2026, 06:02');
  });

  it('a virada de dia respeita o fuso: 01:30 UTC ainda é o dia anterior em São Paulo', () => {
    expect(formatarAtualizadoEm('2026-10-23T01:30:00Z')).toBe('22/10/2026, 22:30');
  });

  it('meia-noite é 00:00, nunca 24:00', () => {
    expect(formatarAtualizadoEm('2026-10-23T03:00:00Z')).toBe('23/10/2026, 00:00');
  });

  it('sem instante ou com ISO inválido não inventa horário', () => {
    expect(formatarAtualizadoEm(null)).toBeNull();
    expect(formatarAtualizadoEm(undefined)).toBeNull();
    expect(formatarAtualizadoEm('')).toBeNull();
    expect(formatarAtualizadoEm('ontem')).toBeNull();
  });
});
