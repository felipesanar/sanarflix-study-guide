/**
 * Interpretador da lista de desenho (`template.draw`) com jsPDF. Espelho de `draw_card` em
 * `services/cartao-omr/cartao_omr/card.py`: nenhuma medida mora aqui, só a tradução de cada operação.
 *
 * Sem imports com alias (`@/`) e sem sintaxe que o TypeScript não consiga apagar, para o mesmo arquivo
 * rodar no Vite, no Vitest e direto no Node (`services/cartao-omr/tools/emitir_ts.mts`).
 */
import type { jsPDF } from 'jspdf';
import { buildPayload, cartaoPorEmail, normalizarMatricula } from './payload.ts';
import { encodeQr } from './qr.ts';
import type { CardSpec, CardTemplate, DrawOp } from './types.ts';

const PT_MM = 25.4 / 72;

type Slot = 'titulo' | 'subtitulo' | 'aluno' | 'matricula' | 'dica_matricula' | 'label';

function fonte(nome: string): [string, 'normal' | 'bold'] {
  if (nome === 'Helvetica') return ['helvetica', 'normal'];
  if (nome === 'Helvetica-Bold') return ['helvetica', 'bold'];
  if (nome === 'Courier-Bold') return ['courier', 'bold'];
  throw new Error(`fonte desconhecida no template: ${nome}`);
}

function usarFonte(doc: jsPDF, nome: string, tamanho: number, cor: string): void {
  const [familia, estilo] = fonte(nome);
  doc.setFont(familia, estilo);
  doc.setFontSize(tamanho);
  doc.setTextColor(cor);
}

/** Textos variáveis do cartão. Slot vazio não é desenhado. */
export function slotValues(spec: CardSpec): Record<Slot, string> {
  const partes: string[] = [];
  if (spec.ies) partes.push(`Instituição: ${spec.ies}`);
  if (spec.data) partes.push(`Data: ${spec.data}`);
  return {
    titulo: 'CARTÃO-RESPOSTA' + (spec.nomeSimulado ? ` — ${spec.nomeSimulado}` : ''),
    subtitulo: partes.join('  •  '),
    aluno: spec.model === 'personalizado' ? (spec.alunoNome ?? '') : '',
    matricula: spec.model === 'personalizado' ? normalizarMatricula(spec.matricula) : '',
    dica_matricula: cartaoPorEmail(spec) ? 'escreva sua matrícula abaixo' : '',
    label: spec.label ?? '',
  };
}

/** Encolhe o corpo (0,25 pt por vez) até caber; se ainda não couber, corta com reticências. */
export function fitText(
  doc: jsPDF,
  s: string,
  nomeFonte: string,
  tamanho: number,
  maxWmm: number,
  minTamanho: number,
): { s: string; size: number } {
  const largura = (texto: string, corpo: number): number => {
    const [familia, estilo] = fonte(nomeFonte);
    doc.setFont(familia, estilo);
    doc.setFontSize(corpo);
    return doc.getTextWidth(texto);
  };
  let size = tamanho;
  while (size > minTamanho && largura(s, size) > maxWmm) size -= 0.25;
  if (largura(s, size) <= maxWmm) return { s, size };
  let corte = s;
  while (corte.length > 1 && largura(corte + '…', size) > maxWmm) corte = corte.slice(0, -1);
  return { s: corte.trimEnd() + '…', size };
}

function estilo(op: { fill?: string | undefined; stroke?: string | undefined }): 'F' | 'S' | 'FD' {
  return op.fill && op.stroke ? 'FD' : op.fill ? 'F' : 'S';
}

function aplicarTracoEPreenchimento(
  doc: jsPDF,
  op: { fill?: string | undefined; stroke?: string | undefined; lw?: number | undefined },
): void {
  if (op.fill) doc.setFillColor(op.fill);
  if (op.stroke) {
    doc.setDrawColor(op.stroke);
    doc.setLineWidth((op.lw ?? 0.5) * PT_MM);
  }
}

function desenharQr(doc: jsPDF, op: Extract<DrawOp, { op: 'qr' }>, payload: string): void {
  const matriz = encodeQr(payload);
  const modulos = matriz.length;
  const [x0, y0, x1] = op.box;
  const mod = (x1 - x0) / (modulos + 2 * op.quiet);
  const ox = x0 + op.quiet * mod;
  const oy = y0 + op.quiet * mod;
  doc.setFillColor(op.color);
  matriz.forEach((linha, r) => {
    let c = 0;
    while (c < modulos) {
      if (linha[c]) {
        const inicio = c;
        while (c < modulos && linha[c]) c++;
        doc.rect(ox + inicio * mod, oy + r * mod, (c - inicio) * mod, mod, 'F');
      } else {
        c++;
      }
    }
  });
}

function desenharBolhas(doc: jsPDF, op: Extract<DrawOp, { op: 'bubbles' }>, template: CardTemplate): void {
  doc.setFillColor(op.fill);
  doc.setDrawColor(op.stroke);
  doc.setLineWidth(op.lw * PT_MM);
  const [familia, estiloFonte] = fonte('Helvetica');
  const bolha = (cx: number, cy: number, d: number, letra: string): void => {
    doc.setFillColor(op.fill);
    doc.setDrawColor(op.stroke);
    doc.setLineWidth(op.lw * PT_MM);
    doc.circle(cx, cy, d / 2, 'FD');
    doc.setFont(familia, estiloFonte);
    doc.setFontSize(op.letter_size);
    doc.setTextColor(op.letter_color);
    doc.text(letra, cx, cy + op.letter_dy, { align: 'center' });
  };
  const numeros = Object.keys(template.questions).sort((a, b) => Number(a) - Number(b));
  for (const q of numeros) {
    for (const alt of template.alternatives) {
      const [cx, cy, d] = template.questions[q]![alt]!;
      bolha(cx, cy, d, alt);
    }
  }
  for (const coluna of template.matricula?.columns ?? []) {
    for (const b of coluna) bolha(b.c[0], b.c[1], b.c[2], b.symbol);
  }
}

/** Desenha um cartão na página atual do documento, interpretando `template.draw`. */
export function drawCard(doc: jsPDF, template: CardTemplate, spec: CardSpec): void {
  const layoutDoCartao = spec.model === 'uniatenas' ? 'uniatenas' : 'sfa';
  if (layoutDoCartao !== template.layout) {
    throw new Error(`cartão ${spec.model} não combina com o layout ${template.layout}`);
  }
  const slots = slotValues(spec);
  for (const op of template.draw) {
    switch (op.op) {
      case 'rect':
        aplicarTracoEPreenchimento(doc, op);
        doc.rect(op.x0, op.y0, op.x1 - op.x0, op.y1 - op.y0, estilo(op));
        break;
      case 'circle':
        aplicarTracoEPreenchimento(doc, op);
        doc.circle(op.cx, op.cy, op.d / 2, estilo(op));
        break;
      case 'line':
        doc.setDrawColor(op.color);
        doc.setLineWidth(op.lw * PT_MM);
        doc.line(op.x0, op.y0, op.x1, op.y1);
        break;
      case 'poly':
        doc.setDrawColor(op.color);
        doc.setLineWidth(op.lw * PT_MM);
        doc.setLineCap('round');
        doc.setLineJoin('round');
        for (let i = 0; i + 1 < op.pts.length; i++) {
          doc.line(op.pts[i]![0], op.pts[i]![1], op.pts[i + 1]![0], op.pts[i + 1]![1]);
        }
        doc.setLineCap('butt');
        doc.setLineJoin('miter');
        break;
      case 'text': {
        let s = op.s ?? '';
        let size = op.size;
        if (op.slot) {
          s = slots[op.slot];
          if (!s) break;
          if (op.max_w !== undefined && op.min_size !== undefined) {
            const f = fitText(doc, s, op.font, size, op.max_w, op.min_size);
            s = f.s;
            size = f.size;
          }
        }
        usarFonte(doc, op.font, size, op.color);
        doc.text(s, op.x, op.y, { align: op.align ?? 'left' });
        break;
      }
      case 'numbers':
        usarFonte(doc, op.font, op.size, op.color);
        for (const [q, x, y] of op.items) doc.text(String(q), x, y, { align: 'right' });
        break;
      case 'bubbles':
        desenharBolhas(doc, op, template);
        break;
      case 'qr':
        desenharQr(doc, op, buildPayload(spec));
        break;
      default: {
        const desconhecida: never = op;
        throw new Error(`operação de desenho desconhecida: ${JSON.stringify(desconhecida)}`);
      }
    }
  }
}
