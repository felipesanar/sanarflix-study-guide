/**
 * Gerador de QR Code (ISO/IEC 18004) mínimo para o cartão-resposta.
 *
 * Só o que o cartão usa: correção de erro nível Q, versões 1 a 9, modo alfanumérico (maiúsculas, dígitos e
 * `space $ % * + - . / :`) ou byte (UTF-8), segmento único, máscara escolhida pela menor penalidade.
 * Sem dependências: o Academy não precisa de lib de QR nova.
 *
 * A saída é conferida contra o `segno` (Python) em `__tests__/qr.test.ts`, módulo por módulo,
 * e o QR do PDF é lido de volta pelo `zxing-cpp` nos testes de paridade do `services/cartao-omr`.
 */

export type QrMatrix = boolean[][];

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

interface EcSpec {
  /** Palavras de correção por bloco. */
  ec: number;
  /** [nº de blocos, palavras de dados por bloco] por grupo. */
  groups: Array<[number, number]>;
}

/** Nível Q, versões 1 a 9 (ISO 18004, tabela 9). */
const EC_Q: Record<number, EcSpec> = {
  1: { ec: 13, groups: [[1, 13]] },
  2: { ec: 22, groups: [[1, 22]] },
  3: { ec: 18, groups: [[2, 17]] },
  4: { ec: 26, groups: [[2, 24]] },
  5: { ec: 18, groups: [[2, 15], [2, 16]] },
  6: { ec: 24, groups: [[4, 19]] },
  7: { ec: 18, groups: [[2, 14], [4, 15]] },
  8: { ec: 22, groups: [[4, 18], [2, 19]] },
  9: { ec: 20, groups: [[4, 16], [4, 17]] },
};

const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
};

const FORMAT_BITS_Q = 3; // L=1, M=0, Q=3, H=2
export const MAX_VERSION = 9;

// ------------------------------------------------------------------ GF(256) e Reed-Solomon
const EXP = new Array<number>(512).fill(0);
const LOG = new Array<number>(256).fill(0);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!;
}

/** Polinômio gerador (mônico, sem o termo líder) de grau `deg`. */
function rsGenerator(deg: number): number[] {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j]! ^ gfMul(poly[j]!, EXP[i]!)) & 0xff;
      next[j + 1] = (next[j + 1]! ^ poly[j]!) & 0xff;
    }
    poly = next;
  }
  // `poly` está em ordem crescente de grau com líder em [deg]; devolve sem o líder, em ordem decrescente.
  return poly.slice(0, deg).reverse();
}

function rsRemainder(data: number[], gen: number[]): number[] {
  const rem = new Array<number>(gen.length).fill(0);
  for (const b of data) {
    const factor = b ^ rem.shift()!;
    rem.push(0);
    for (let i = 0; i < gen.length; i++) rem[i] = rem[i]! ^ gfMul(gen[i]!, factor);
  }
  return rem;
}

// ------------------------------------------------------------------ codificação dos dados
class BitBuffer {
  readonly bits: number[] = [];
  push(value: number, len: number): void {
    for (let i = len - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length(): number {
    return this.bits.length;
  }
}

function isAlnum(text: string): boolean {
  for (const ch of text) if (!ALNUM.includes(ch)) return false;
  return true;
}

function countBits(mode: 'alnum' | 'byte'): number {
  return mode === 'alnum' ? 9 : 8; // versões 1 a 9
}

function dataCapacity(version: number): number {
  return EC_Q[version]!.groups.reduce((s, [n, d]) => s + n * d, 0);
}

function encodeData(text: string): { buf: BitBuffer; version: number } {
  const alnum = isAlnum(text);
  const mode: 'alnum' | 'byte' = alnum ? 'alnum' : 'byte';
  const bytes = alnum ? [] : Array.from(new TextEncoder().encode(text));
  const count = alnum ? text.length : bytes.length;
  const payloadBits = alnum ? Math.floor(count / 2) * 11 + (count % 2) * 6 : count * 8;
  let version = 0;
  for (let v = 1; v <= MAX_VERSION; v++) {
    if (4 + countBits(mode) + payloadBits <= dataCapacity(v) * 8) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error(`texto longo demais para um QR nível Q versão ${MAX_VERSION} (${count} caracteres)`);

  const buf = new BitBuffer();
  if (alnum) {
    buf.push(0b0010, 4);
    buf.push(count, 9);
    for (let i = 0; i + 1 < count; i += 2) {
      buf.push(ALNUM.indexOf(text[i]!) * 45 + ALNUM.indexOf(text[i + 1]!), 11);
    }
    if (count % 2) buf.push(ALNUM.indexOf(text[count - 1]!), 6);
  } else {
    buf.push(0b0100, 4);
    buf.push(count, 8);
    for (const b of bytes) buf.push(b, 8);
  }
  const capBits = dataCapacity(version) * 8;
  buf.push(0, Math.min(4, capBits - buf.length)); // terminador
  // Compatível com o `segno`: se os dados já terminam alinhados em byte, ele ainda acrescenta um byte 0x00
  // antes do enchimento. O QR continua válido para qualquer leitor; copiar isso faz os dois geradores
  // produzirem o MESMO QR.
  buf.push(0, Math.min(8 - (buf.length % 8), capBits - buf.length));
  for (let pad = 0xec; buf.length < capBits; pad ^= 0xec ^ 0x11) buf.push(pad, 8);
  return { buf, version };
}

function toCodewords(buf: BitBuffer): number[] {
  const out: number[] = [];
  for (let i = 0; i < buf.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | buf.bits[i + j]!;
    out.push(v);
  }
  return out;
}

/** Divide em blocos, calcula a correção e intercala (ISO 18004, 7.6). */
function interleave(data: number[], version: number): number[] {
  const spec = EC_Q[version]!;
  const gen = rsGenerator(spec.ec);
  const blocks: Array<{ data: number[]; ec: number[] }> = [];
  let pos = 0;
  for (const [n, len] of spec.groups) {
    for (let i = 0; i < n; i++) {
      const d = data.slice(pos, pos + len);
      pos += len;
      blocks.push({ data: d, ec: rsRemainder(d, gen) });
    }
  }
  const out: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]!);
  for (let i = 0; i < spec.ec; i++) for (const b of blocks) out.push(b.ec[i]!);
  return out;
}

// ------------------------------------------------------------------ matriz
function bit(value: number, i: number): boolean {
  return ((value >>> i) & 1) !== 0;
}

class Grid {
  readonly version: number;
  readonly size: number;
  readonly modules: boolean[][];
  readonly fixed: boolean[][];
  /** Células de formato e versão (o `segno` avalia as máscaras sem elas). */
  readonly info = new Set<number>();
  constructor(version: number) {
    this.version = version;
    this.size = 17 + 4 * version;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }
  /** x = coluna, y = linha. */
  setFunction(x: number, y: number, dark: boolean): void {
    this.modules[y]![x] = dark;
    this.fixed[y]![x] = true;
  }
  setInfo(x: number, y: number, dark: boolean): void {
    this.setFunction(x, y, dark);
    this.info.add(y * this.size + x);
  }
  /** Matriz como é avaliada na escolha da máscara: sem formato nem versão. */
  evaluationView(): boolean[][] {
    return this.modules.map((row, y) => row.map((v, x) => (this.info.has(y * this.size + x) ? false : v)));
  }
}

function drawFunctionPatterns(g: Grid): void {
  const { size, version } = g;
  for (let i = 0; i < size; i++) {
    g.setFunction(6, i, i % 2 === 0); // temporização
    g.setFunction(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) g.setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }
  const pos = ALIGNMENT[version]!;
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) g.setFunction(pos[i]! + dx, pos[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  drawFormat(g, 0); // reserva as áreas (reescrito depois com a máscara)
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      g.setInfo(a, b, bit(bits, i));
      g.setInfo(b, a, bit(bits, i));
    }
  }
}

function drawFormat(g: Grid, mask: number): void {
  const { size } = g;
  const data = (FORMAT_BITS_Q << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  for (let i = 0; i <= 5; i++) g.setInfo(8, i, bit(bits, i));
  g.setInfo(8, 7, bit(bits, 6));
  g.setInfo(8, 8, bit(bits, 7));
  g.setInfo(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) g.setInfo(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) g.setInfo(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) g.setInfo(8, size - 15 + i, bit(bits, i));
  g.setInfo(8, size - 8, true); // módulo escuro fixo (o segno só o põe depois de escolher a máscara)
}

function placeData(g: Grid, codewords: number[]): void {
  const { size } = g;
  let i = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!g.fixed[y]![x] && i < total) {
          g.modules[y]![x] = bit(codewords[i >>> 3]!, 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(g: Grid, mask: number): void {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.fixed[y]![x] && maskBit(mask, x, y)) g.modules[y]![x] = !g.modules[y]![x];
    }
  }
}

// ------------------------------------------------------------------ penalidade (ISO 18004, 7.8.3)
const N3_PATTERN = [true, false, true, true, true, false, true];

function indexOfPattern(seq: boolean[], from: number): number {
  for (let i = from; i + 7 <= seq.length; i++) {
    if (N3_PATTERN.every((v, k) => seq[i + k] === v)) return i;
  }
  return -1;
}

function anyDark(seq: boolean[], from: number, to: number): boolean {
  for (let i = Math.max(from, 0); i < Math.min(to, seq.length); i++) if (seq[i]) return true;
  return false;
}

function n3(seq: boolean[]): number {
  const size = seq.length;
  let count = 0;
  let idx = indexOfPattern(seq, 0);
  while (idx !== -1) {
    let offset = idx + 7;
    if (idx === 0 || idx === size - 7 || !anyDark(seq, idx - 4, idx) || !anyDark(seq, offset, offset + 4)) {
      count += 40;
    } else {
      offset = idx + 4;
    }
    idx = indexOfPattern(seq, offset);
  }
  return count;
}

function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  // N1: sequências de 5 ou mais módulos iguais em linha ou coluna
  for (let a = 0; a < n; a++) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let b = 1; b < n; b++) {
        const cur = horizontal ? m[a]![b]! : m[b]![a]!;
        const prev = horizontal ? m[a]![b - 1]! : m[b - 1]![a]!;
        if (cur === prev) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  }
  // N2: blocos 2x2 da mesma cor
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = m[y]![x]!;
      if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) score += 3;
    }
  }
  // N3: 1011101 com 4 módulos claros antes ou depois (ou encostado na borda); mesma regra do `segno`
  for (let a = 0; a < n; a++) {
    score += n3(m[a]!);
    score += n3(m.map((row) => row[a]!));
  }
  // N4: proporção de módulos escuros
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

// ------------------------------------------------------------------ API
/** Gera o QR (nível Q) de `text` e devolve a matriz de módulos escuros (sem zona de silêncio). */
export function encodeQr(text: string): QrMatrix {
  const { buf, version } = encodeData(text);
  const codewords = interleave(toCodewords(buf), version);
  const g = new Grid(version);
  drawFunctionPatterns(g);
  placeData(g, codewords);

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(g, mask);
    drawFormat(g, mask);
    const score = penalty(g.evaluationView());
    if (score < bestScore) {
      bestScore = score;
      best = g.modules.map((row) => row.slice());
    }
    applyMask(g, mask); // desfaz (a máscara é uma involução)
  }
  return best!;
}

/** Versão do QR (1 a 9) de uma matriz gerada por `encodeQr`. */
export function qrVersion(matrix: QrMatrix): number {
  return (matrix.length - 17) / 4;
}
