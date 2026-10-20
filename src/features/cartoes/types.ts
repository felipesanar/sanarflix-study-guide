/** Tipos do emissor de cartões-resposta (espelham `services/cartao-omr`). */

export type ModeloCartao = 'personalizado' | 'uniatenas';
export type LayoutCartao = 'sfa' | 'uniatenas';

/** Conteúdo variável de um cartão; a geometria vem do template. */
export interface CardSpec {
  model: ModeloCartao;
  simuladoId: string;
  nomeSimulado?: string;
  ies?: string;
  /** Data da prova já formatada, ex.: `25/10/2026`. */
  data?: string;
  /** Só no personalizado. */
  alunoNome?: string;
  /** Só no personalizado; normalizada (`trim` + maiúsculas) ao montar o QR. */
  matricula?: string;
  /** Código legível sob o QR. */
  label?: string;
}

export interface QrData {
  kind: 'M' | 'A';
  sim8: string;
  matricula: string | null;
}

// ---------------------------------------------------------------- lista de desenho (ver cartao_omr/drawlist.py)
export type DrawOp =
  | { op: 'rect'; x0: number; y0: number; x1: number; y1: number; fill?: string; stroke?: string; lw?: number }
  | { op: 'circle'; cx: number; cy: number; d: number; fill?: string; stroke?: string; lw?: number }
  | { op: 'line'; x0: number; y0: number; x1: number; y1: number; color: string; lw: number }
  | { op: 'poly'; pts: Array<[number, number]>; color: string; lw: number }
  | {
      op: 'text';
      x: number;
      y: number;
      font: string;
      size: number;
      color: string;
      align?: 'left' | 'right' | 'center';
      s?: string;
      slot?: 'titulo' | 'subtitulo' | 'aluno' | 'matricula' | 'label';
      max_w?: number;
      min_size?: number;
    }
  | { op: 'numbers'; font: string; size: number; color: string; items: Array<[number, number, number]> }
  | {
      op: 'bubbles';
      stroke: string;
      lw: number;
      fill: string;
      letter_color: string;
      letter_size: number;
      letter_dy: number;
    }
  | { op: 'qr'; box: [number, number, number, number]; quiet: number; ec: string; color: string };

export interface CardTemplate {
  template_version: string;
  layout: LayoutCartao;
  page_mm: [number, number];
  alternatives: string[];
  /** `questions[numero][alternativa] = [cx, cy, d]`. */
  questions: Record<string, Record<string, [number, number, number]>>;
  matricula: {
    columns: Array<Array<{ symbol: string; c: [number, number, number] }>>;
  } | null;
  draw_version: number;
  draw: DrawOp[];
}
