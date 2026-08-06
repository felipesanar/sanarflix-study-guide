// src/features/gestor/__tests__/contrasteDestructive.test.tsx
//
// Triagem dos 5 usos restantes de `--destructive` no Portal do Gestor v2, fora
// do KpiCard (já corrigido e coberto por contrasteKpi.test.tsx — mesma
// metodologia reaproveitada aqui: (1) render prova a classe certa no nó
// certo, (2) análise estática de texto-fonte prova que o token certo é
// referenciado e o literal errado não voltou, (3) matemática WCAG 2.1
// executável a partir dos valores REAIS de gestor-theme.css e src/index.css
// — nunca `toBe(numero)` cego, reprova sozinha se algum token mudar sem
// recalcular).
//
// Critério (o mesmo da task): TEXTO exige 4,5:1; gráfico/componente de UI
// exige 3:1; ícone puramente decorativo (`aria-hidden`, redundante com texto
// sempre presente) não tem mínimo — SC 1.4.11 só cobre gráfico "necessário
// para entender o conteúdo".
//
// VEREDITO por ponto (4 trocaram, 1 ficou — a conta de cada um abaixo):
//
// 1) AreasChart.tsx — <span> "área crítica" na legenda. TEXTO (10px, peso
//    "medium"/500 — NÃO é "bold" (>=700) para fins de WCAG, logo não é
//    "texto grande" nem a 10px; mínimo 4,5:1). Fundo real: card (botão no
//    estado padrão) OU muted (botão isolado) — os dois alcançáveis, já que a
//    isolação é um toggle independente de `critica`. `text-destructive`:
//    3,7810:1/3,4357:1 no claro, 3,4829:1/3,3038:1 no escuro — reprova nos
//    dois fundos, nos dois temas. TROCOU para `gp-text-danger`
//    (`--gp-danger-on`): 11,0884:1/10,0756:1 claro, 7,1471:1/6,7795:1 escuro.
//    NÃO mexido: `CORES[0]` (`var(--destructive)`, linha ~30) — é a cor de
//    POSIÇÃO 0 da paleta (comentário do próprio arquivo, linhas 24-27: a área
//    crítica não ganha cor própria, só espessura/opacidade), não o sinal de
//    "crítica"; trocar o texto do badge não muda a leitura do gráfico.
//
// 2) AcertoPorAreaESemestre.tsx — <span> do nome da área. TEXTO (text-sm =
//    14px, peso normal; mínimo 4,5:1). Fundo real: card (padrão) OU
//    card+primary/5% (quando esta área é o recorte cruzado "ativo" —
//    `bg-primary/5`). `text-destructive`: 3,7810:1/3,4770:1 claro,
//    3,4829:1/3,3953:1 escuro — reprova nos dois. TROCOU para
//    `gp-text-danger`: 11,0884:1/10,1968:1 claro, 7,1471:1/6,9674:1 escuro.
//
// 3) DistribuicaoAlternativas.tsx — <span> "distrator dominante". TEXTO
//    (text-xs = 12px; mínimo 4,5:1) sobre um chip TINTADO — o fundo real não
//    é o card puro, é `bg-destructive/10` (destructive a 10% opacidade
//    composto sobre o card): rgb(253,236,236) no claro, rgb(41,26,31) no
//    escuro. `text-destructive` contra ESSE fundo: 3,3104:1 claro, 3,2640:1
//    escuro — reprova. TROCOU só o texto — `bg-destructive/10` continua
//    intocado, não é ele que falha — para `gp-text-danger`: 9,7081:1 claro,
//    6,6978:1 escuro.
//
// 4) EstadoErro.tsx — <AlertTriangle aria-hidden="true">. ÍCONE decorativo.
//    FICOU — nenhuma linha mudou neste arquivo. O texto ao lado
//    (`<p>{titulo}</p>`, com default sempre presente) já conta sozinho a
//    história ("não foi possível carregar"); o ícone é aria-hidden (um leitor
//    de tela nunca o anuncia) e redundante para quem vê. SC 1.4.11 (Non-text
//    Contrast) só exige contraste de gráfico "necessário para entender o
//    conteúdo" — não é o caso. Números medidos por RIGOR, não por exigência
//    (nenhum assert de pass/fail de threshold gate aqui): 3,5519:1/3,3868:1
//    contra bg-destructive/5% sobre CARD (uso dentro de KpiCard/CardContent),
//    3,5519:1/4,0280:1 contra bg-destructive/5% sobre --background (uso
//    direto no <section> do BlocoGestor, sem Card). As quatro leituras ficam
//    ACIMA de 3:1 mesmo — mas isso não decide nada: não é o padrão aplicável
//    a um ícone decorativo, e trocar seria mudança estética sem ganho de
//    acessibilidade (e arriscaria alterar o visual sem necessidade real).
//
// 5) SeletorSimulados.tsx — <p role="alert" className="...text-destructive">.
//    TEXTO real "Escolha ao menos um simulado" (text-sm, mínimo 4,5:1); o
//    `<Info aria-hidden="true">` dentro do mesmo <p> só HERDA a cor por
//    `currentColor` — não é avaliado à parte (mesmo raciocínio de "decorativo
//    e redundante" do ponto 4, mas aqui a mudança na TEXTO já recolore o
//    ícone como efeito colateral, não como decisão própria). Fundo real:
//    bg-card do container — mesmíssimos números do KpiCard: `text-destructive`
//    3,7810:1 claro, 3,4829:1 escuro — reprova. TROCOU para `gp-text-danger`:
//    11,0884:1 claro, 7,1471:1 escuro.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@/test/utils';
import { AreasChart } from '@/features/gestor/charts/AreasChart';
import { DistribuicaoAlternativas } from '@/features/gestor/charts/DistribuicaoAlternativas';
import { AcertoPorAreaESemestre } from '@/features/gestor/components/AcertoPorAreaESemestre';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { SeletorSimulados } from '@/features/gestor/components/SeletorSimulados';
import type {
  Alternativa,
  AcertoPorAreaESemestre as DadosAcertoPorAreaESemestre,
  ItemCronograma,
  VisaoGeral,
} from '@/features/gestor/api/types';

const RAIZ = resolve(__dirname, '..');
const CSS_TEMA = readFileSync(resolve(RAIZ, 'gestor-theme.css'), 'utf-8');
const INDEX_CSS = readFileSync(resolve(RAIZ, '../../index.css'), 'utf-8');
const SRC_AREAS_CHART = readFileSync(resolve(RAIZ, 'charts/AreasChart.tsx'), 'utf-8');
const SRC_ACERTO = readFileSync(resolve(RAIZ, 'components/AcertoPorAreaESemestre.tsx'), 'utf-8');
const SRC_DISTRIBUICAO = readFileSync(resolve(RAIZ, 'charts/DistribuicaoAlternativas.tsx'), 'utf-8');
const SRC_ESTADO_ERRO = readFileSync(resolve(RAIZ, 'components/EstadoErro.tsx'), 'utf-8');
const SRC_SELETOR = readFileSync(resolve(RAIZ, 'components/SeletorSimulados.tsx'), 'utf-8');

const classesDe = (elemento: Element) => new Set(elemento.className.split(/\s+/).filter(Boolean));
const semComentarios = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ---------------------------------------------------------------------- */
/* 1) Render: a classe certa no nó certo — DOM real via Testing Library.   */
/*    (jsdom não resolve `var(--gp-danger-on)` vindo de CSS importado de   */
/*    arquivo — mesma limitação documentada em contrasteKpi.test.tsx — por */
/*    isso o que se prova aqui é a CLASSE aplicada, não a cor computada.)  */
/* ---------------------------------------------------------------------- */

describe('AreasChart — badge "área crítica"', () => {
  const areas: VisaoGeral['evolucaoPorArea'] = [
    { area: 'Clínica Médica', critica: true, pontos: [{ rotulo: 'Simulado 1', valor: 28 }] },
    { area: 'Cirurgia', critica: false, pontos: [{ rotulo: 'Simulado 1', valor: 58 }] },
  ];

  it('usa gp-text-danger, nunca text-destructive — e CORES[0] (série do gráfico) segue intocado', () => {
    render(<AreasChart areas={areas} largura={640} altura={320} />);
    const botao = screen.getByRole('button', { name: /Clínica Médica/ });
    const badge = within(botao).getByText('área crítica');
    const classes = classesDe(badge);
    expect(classes.has('gp-text-danger')).toBe(true);
    expect(classes.has('text-destructive')).toBe(false);
  });
});

describe('AcertoPorAreaESemestre — nome da área', () => {
  const dados: DadosAcertoPorAreaESemestre = {
    areas: [
      { id: 'clinica', nome: 'Clínica Médica', acertoPct: 72, critica: false },
      { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 41, critica: true },
    ],
    semestres: [{ semestre: 11, acertoPct: 63, emEvidencia: true }],
  };

  it('área crítica usa gp-text-danger; área não-crítica continua text-foreground', () => {
    render(<AcertoPorAreaESemestre dados={dados} semestre="geral" />);

    const cirurgia = screen.getByTestId('area-cirurgia');
    const nomeCirurgia = within(cirurgia).getByText('Cirurgia');
    expect(classesDe(nomeCirurgia).has('gp-text-danger')).toBe(true);
    expect(classesDe(nomeCirurgia).has('text-destructive')).toBe(false);

    const clinica = screen.getByTestId('area-clinica');
    const nomeClinica = within(clinica).getByText('Clínica Médica');
    expect(classesDe(nomeClinica).has('text-foreground')).toBe(true);
    expect(classesDe(nomeClinica).has('gp-text-danger')).toBe(false);
  });
});

describe('DistribuicaoAlternativas — "distrator dominante"', () => {
  const alternativas: Alternativa[] = [
    { letra: 'A', texto: 'Alternativa A', correta: true, marcadaPct: 40 },
    { letra: 'B', texto: 'Alternativa B', correta: false, marcadaPct: 35 },
    { letra: 'C', texto: 'Alternativa C', correta: false, marcadaPct: 10 },
  ];

  it('o texto do chip usa gp-text-danger; o fundo tintado bg-destructive/10 não muda', () => {
    render(<DistribuicaoAlternativas alternativas={alternativas} />);
    const linhaB = screen.getByTestId('alternativa-B');
    const chip = within(linhaB).getByText('distrator dominante');
    const classes = classesDe(chip);
    expect(classes.has('gp-text-danger')).toBe(true);
    expect(classes.has('text-destructive')).toBe(false);
    expect(classes.has('bg-destructive/10')).toBe(true);
  });
});

describe('SeletorSimulados — alerta de seleção mínima', () => {
  const itens: ItemCronograma[] = [
    { id: 's1', nome: 'Simulado 1', data: '2026-03-10T13:00:00Z', status: 'realizado', modalidade: 'online', participantes: 40 },
  ];

  it('o <p role="alert"> usa gp-text-danger (o <Info> aria-hidden só herda por currentColor)', () => {
    render(<SeletorSimulados itens={itens} selecionados={[]} onChange={() => undefined} />);
    const alerta = screen.getByRole('alert');
    const classes = classesDe(alerta);
    expect(classes.has('gp-text-danger')).toBe(true);
    expect(classes.has('text-destructive')).toBe(false);
    expect(alerta).toHaveTextContent('Escolha ao menos um simulado');
  });
});

describe('EstadoErro — FICOU: ícone decorativo (aria-hidden + redundante com o texto), nada mudou', () => {
  it('o AlertTriangle continua text-destructive e aria-hidden; o texto equivalente está sempre presente ao lado', () => {
    const { container } = render(<EstadoErro onRetry={() => undefined} />);
    const icone = container.querySelector('[role="alert"] > svg');
    expect(icone).not.toBeNull();
    expect(icone).toHaveAttribute('aria-hidden', 'true');
    expect(icone?.getAttribute('class') ?? '').toMatch(/\btext-destructive\b/);
    // titulo tem default — o ícone nunca aparece sem um texto equivalente ao lado.
    expect(screen.getByText('Não foi possível carregar este bloco')).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------- */
/* 2) Análise estática de texto-fonte — independe de jsdom.                */
/* ---------------------------------------------------------------------- */

describe('fonte — os 4 pontos corrigidos não usam mais text-destructive; usos fora de escopo continuam', () => {
  it('AreasChart.tsx: badge não usa text-destructive; CORES[0] (série) continua var(--destructive)', () => {
    const semComent = semComentarios(SRC_AREAS_CHART);
    expect(semComent).not.toMatch(/text-destructive/);
    expect(semComent).toMatch(/gp-text-danger/);
    expect(semComent).toMatch(/hsl\(var\(--destructive\)\)/); // CORES[0], fora de escopo — intocado
  });

  it('AcertoPorAreaESemestre.tsx: nome da área não usa mais text-destructive; bg-destructive (barra) continua', () => {
    const semComent = semComentarios(SRC_ACERTO);
    expect(semComent).not.toMatch(/text-destructive/);
    expect(semComent).toMatch(/gp-text-danger/);
    expect(semComent).toMatch(/'bg-destructive'/); // barra de progresso da área crítica, fora de escopo
  });

  it('DistribuicaoAlternativas.tsx: chip não usa mais text-destructive; bg-destructive/10 e a barra (fora de escopo) continuam', () => {
    const semComent = semComentarios(SRC_DISTRIBUICAO);
    expect(semComent).not.toMatch(/text-destructive\b/);
    expect(semComent).toMatch(/gp-text-danger/);
    expect(semComent).toMatch(/bg-destructive\/10/);
    expect(semComent).toMatch(/\?\s*'bg-destructive'/); // barra de marcação do distrator, fora de escopo
  });

  it('SeletorSimulados.tsx: <p> do alerta não usa mais text-destructive; border/ring-destructive (estado inválido) continuam', () => {
    const semComent = semComentarios(SRC_SELETOR);
    expect(semComent).not.toMatch(/text-destructive/);
    expect(semComent).toMatch(/gp-text-danger/);
    expect(semComent).toMatch(/border-destructive/);
    expect(semComent).toMatch(/ring-destructive\/20/);
  });

  it('EstadoErro.tsx: NADA mudou — ícone continua text-destructive, sem gp-text-danger (decorativo, sem correção aplicável)', () => {
    const semComent = semComentarios(SRC_ESTADO_ERRO);
    expect(semComent).toMatch(/text-destructive/);
    expect(semComent).not.toMatch(/gp-text-danger/);
  });
});

/* ---------------------------------------------------------------------- */
/* 3) Matemática WCAG 2.1 — a partir dos valores REAIS dos arquivos-fonte  */
/*    (mesma fórmula de contrasteKpi.test.tsx: nunca hardcoded às cegas).  */
/* ---------------------------------------------------------------------- */

type RGB = [number, number, number];

function hslParaRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const m = l - c / 2;
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

function parseHslTripla(tripla: string): RGB {
  const [h, s, l] = tripla.trim().split(/\s+/);
  return hslParaRgb(parseFloat(h), parseFloat(s) / 100, parseFloat(l) / 100);
}

function luminanciaRelativa([r, g, b]: RGB): number {
  const canal = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function razaoDeContraste(fg: RGB, bg: RGB): number {
  const l1 = luminanciaRelativa(fg);
  const l2 = luminanciaRelativa(bg);
  const claro = Math.max(l1, l2);
  const escuro = Math.min(l1, l2);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Alpha-composite de fg (com opacidade) sobre bg opaco — a mesma matemática que
 * o navegador usa para renderizar `bg-destructive/10`, `bg-primary/5` etc. */
function compositar(fg: RGB, alpha: number, bg: RGB): RGB {
  return [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha))) as RGB;
}

function blocoDe(css: string, seletor: string): string {
  const inicioSeletor = css.indexOf(`${seletor} {`);
  if (inicioSeletor < 0) throw new Error(`seletor não encontrado: ${seletor}`);
  const inicioChave = css.indexOf('{', inicioSeletor);
  let profundidade = 0;
  for (let i = inicioChave; i < css.length; i += 1) {
    if (css[i] === '{') profundidade += 1;
    else if (css[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return css.slice(inicioChave + 1, i);
    }
  }
  throw new Error(`chave de fechamento não encontrada para: ${seletor}`);
}

function valorTripla(bloco: string, token: string): string {
  const m = bloco.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!m) throw new Error(`token ausente no bloco: ${token}`);
  const valor = m[1].trim();
  const comHsl = valor.match(/^hsl\(([^)]+)\)$/);
  return comHsl ? comHsl[1] : valor;
}

const claroTema = blocoDe(CSS_TEMA, '.gestor-portal');
const escuroTema = blocoDe(CSS_TEMA, '.dark .gestor-portal');
const claroIndex = blocoDe(INDEX_CSS, ':root');
const escuroIndex = blocoDe(INDEX_CSS, '.dark');

const gpDangerOnClaro = parseHslTripla(valorTripla(claroTema, '--gp-danger-on'));
const gpDangerOnEscuro = parseHslTripla(valorTripla(escuroTema, '--gp-danger-on'));
const cardClaro = parseHslTripla(valorTripla(claroIndex, '--card'));
const cardEscuro = parseHslTripla(valorTripla(escuroIndex, '--card'));
const mutedClaro = parseHslTripla(valorTripla(claroIndex, '--muted'));
const mutedEscuro = parseHslTripla(valorTripla(escuroIndex, '--muted'));
const primaryClaro = parseHslTripla(valorTripla(claroIndex, '--primary'));
const primaryEscuro = parseHslTripla(valorTripla(escuroIndex, '--primary'));
const destructiveClaro = parseHslTripla(valorTripla(claroIndex, '--destructive'));
const destructiveEscuro = parseHslTripla(valorTripla(escuroIndex, '--destructive'));
const backgroundClaro = parseHslTripla(valorTripla(claroIndex, '--background'));
const backgroundEscuro = parseHslTripla(valorTripla(escuroIndex, '--background'));

describe('matemática WCAG — ponto 1 (AreasChart): texto sobre card (padrão) e muted (isolada)', () => {
  it('text-destructive reprova 4,5:1 nos dois fundos, nos dois temas', () => {
    expect(razaoDeContraste(destructiveClaro, cardClaro)).toBeLessThan(4.5);
    expect(razaoDeContraste(destructiveEscuro, cardEscuro)).toBeLessThan(4.5);
    expect(razaoDeContraste(destructiveClaro, mutedClaro)).toBeLessThan(4.5);
    expect(razaoDeContraste(destructiveEscuro, mutedEscuro)).toBeLessThan(4.5);
  });

  it('gp-text-danger passa 4,5:1 nos dois fundos, nos dois temas', () => {
    expect(razaoDeContraste(gpDangerOnClaro, cardClaro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(gpDangerOnEscuro, cardEscuro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(gpDangerOnClaro, mutedClaro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(gpDangerOnEscuro, mutedEscuro)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('matemática WCAG — ponto 2 (AcertoPorAreaESemestre): texto sobre card e card+primary/5% (recorte ativo)', () => {
  const cardPrimario5Claro = compositar(primaryClaro, 0.05, cardClaro);
  const cardPrimario5Escuro = compositar(primaryEscuro, 0.05, cardEscuro);

  it('text-destructive reprova 4,5:1 nos dois fundos, nos dois temas', () => {
    expect(razaoDeContraste(destructiveClaro, cardClaro)).toBeLessThan(4.5);
    expect(razaoDeContraste(destructiveEscuro, cardEscuro)).toBeLessThan(4.5);
    expect(razaoDeContraste(destructiveClaro, cardPrimario5Claro)).toBeLessThan(4.5);
    expect(razaoDeContraste(destructiveEscuro, cardPrimario5Escuro)).toBeLessThan(4.5);
  });

  it('gp-text-danger passa 4,5:1 nos dois fundos, nos dois temas', () => {
    expect(razaoDeContraste(gpDangerOnClaro, cardClaro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(gpDangerOnEscuro, cardEscuro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(gpDangerOnClaro, cardPrimario5Claro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(gpDangerOnEscuro, cardPrimario5Escuro)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('matemática WCAG — ponto 3 (DistribuicaoAlternativas): texto sobre chip destructive/10% (não card puro)', () => {
  const chipClaro = compositar(destructiveClaro, 0.10, cardClaro);
  const chipEscuro = compositar(destructiveEscuro, 0.10, cardEscuro);

  it('o fundo composto do chip bate com o valor citado no comentário do componente', () => {
    expect(chipClaro).toEqual([253, 236, 236]);
    expect(chipEscuro).toEqual([41, 26, 31]);
  });

  it('text-destructive reprova 4,5:1 contra o chip, nos dois temas', () => {
    expect(razaoDeContraste(destructiveClaro, chipClaro)).toBeLessThan(4.5);
    expect(razaoDeContraste(destructiveEscuro, chipEscuro)).toBeLessThan(4.5);
  });

  it('gp-text-danger passa 4,5:1 contra o MESMO chip (bg-destructive/10 não mudou), nos dois temas', () => {
    expect(razaoDeContraste(gpDangerOnClaro, chipClaro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(gpDangerOnEscuro, chipEscuro)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('matemática WCAG — ponto 5 (SeletorSimulados): texto sobre card, mesmo caso do KpiCard', () => {
  it('text-destructive reprova e gp-text-danger passa 4,5:1, nos dois temas', () => {
    expect(razaoDeContraste(destructiveClaro, cardClaro)).toBeLessThan(4.5);
    expect(razaoDeContraste(destructiveEscuro, cardEscuro)).toBeLessThan(4.5);
    expect(razaoDeContraste(gpDangerOnClaro, cardClaro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(gpDangerOnEscuro, cardEscuro)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('matemática WCAG — ponto 4 (EstadoErro): ícone decorativo, contraste medido por rigor, SEM gate de threshold', () => {
  it('contraste contra bg-destructive/5% (sobre card e sobre background) fica documentado, não decide nada', () => {
    const boxCardClaro = compositar(destructiveClaro, 0.05, cardClaro);
    const boxCardEscuro = compositar(destructiveEscuro, 0.05, cardEscuro);
    const boxBgClaro = compositar(destructiveClaro, 0.05, backgroundClaro);
    const boxBgEscuro = compositar(destructiveEscuro, 0.05, backgroundEscuro);

    // Nenhum destes asserts é um "mínimo exigido" — 1.4.11 não se aplica a um
    // ícone aria-hidden redundante com texto sempre presente. É só o registro
    // do número real, como a task pede para os cinco pontos.
    expect(razaoDeContraste(destructiveClaro, boxCardClaro)).toBeCloseTo(3.55, 1);
    expect(razaoDeContraste(destructiveEscuro, boxCardEscuro)).toBeCloseTo(3.39, 1);
    expect(razaoDeContraste(destructiveClaro, boxBgClaro)).toBeCloseTo(3.55, 1);
    expect(razaoDeContraste(destructiveEscuro, boxBgEscuro)).toBeCloseTo(4.03, 1);
  });
});

describe('documentação executável — os literais usados nesta suíte batem com os do achado original (contrasteKpi.test.tsx)', () => {
  it('destructive/card/gp-danger-on têm os mesmos RGB já provados naquela suíte', () => {
    expect(destructiveClaro).toEqual([239, 67, 67]);
    expect(destructiveEscuro).toEqual([207, 48, 48]);
    expect(cardClaro).toEqual([255, 255, 255]);
    expect(gpDangerOnClaro).toEqual([120, 18, 18]);
  });
});
