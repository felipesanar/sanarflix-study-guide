/**
 * Emissão dos cartões-resposta: monta um PDF A4 (uma página por cartão) no navegador, a partir do
 * template. Nada sai do Academy: nem nome, nem user_id, nem o PDF.
 *
 * Mesmas regras do `cartao-omr gerar-cartoes`: um cartão personalizado por aluno, ordenado por nome sem
 * considerar acentos; o cartão UniAtenas é um só, sem nome, repetido `copias` vezes.
 */
import { buildPayload, rotuloDoCartao } from './payload.ts';
import { drawCard } from './render.ts';
import type { CardSpec, CardTemplate, LayoutCartao } from './types.ts';

export interface AlunoEmissao {
  userId: string;
  nome: string;
  /** Nome da IES do aluno, se for diferente da do cabeçalho. */
  ies?: string;
}

export interface OpcoesEmissao {
  layout: LayoutCartao;
  simuladoId: string;
  nomeSimulado?: string;
  ies?: string;
  /** Data da prova já formatada, ex.: `25/10/2026`. */
  data?: string;
  /** Obrigatório no layout `sfa`. */
  alunos?: AlunoEmissao[];
  /** Cópias do cartão UniAtenas (padrão 1). */
  copias?: number;
}

export interface ProgressoEmissao {
  feitas: number;
  total: number;
}

export interface OpcoesPdf {
  onProgress?: (p: ProgressoEmissao) => void;
  /** Devolver `true` interrompe a geração (a promessa é rejeitada com `EmissaoCancelada`). */
  shouldCancel?: () => boolean;
  /** Cede o fio de execução a cada N páginas, para a tela não travar (padrão 4; 0 desliga). */
  ceder?: number;
}

export class EmissaoCancelada extends Error {
  constructor() {
    super('emissão cancelada');
    this.name = 'EmissaoCancelada';
  }
}

function chaveDeOrdem(nome: string): string {
  return nome.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Ordena por nome sem considerar acentos; desempata pelo user_id (igual ao `roster.py`). */
export function ordenarAlunos<T extends { nome: string; userId: string }>(alunos: T[]): T[] {
  return [...alunos].sort((a, b) => {
    const ka = chaveDeOrdem(a.nome);
    const kb = chaveDeOrdem(b.nome);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });
}

/** `2026-10-25` ou `Date` -> `25/10/2026`. Texto que já não for ISO volta como veio. */
export function formatarDataBR(data: string | Date | null | undefined): string {
  if (!data) return '';
  if (data instanceof Date) {
    const d = String(data.getDate()).padStart(2, '0');
    const m = String(data.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${data.getFullYear()}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data;
}

/** Monta o conteúdo variável de cada cartão (e valida os UUID, que viram o QR). */
export function montarSpecs(op: OpcoesEmissao): CardSpec[] {
  const base = { simuladoId: op.simuladoId, nomeSimulado: op.nomeSimulado ?? '', data: op.data ?? '' };
  if (op.layout === 'uniatenas') {
    if (op.alunos?.length) throw new Error('o cartão UniAtenas não é personalizado');
    const copias = op.copias ?? 1;
    if (!Number.isInteger(copias) || copias < 1) throw new Error('copias precisa ser um inteiro maior que zero');
    const spec: CardSpec = { model: 'uniatenas', ...base, ies: op.ies || 'UniAtenas', label: rotuloDoCartao('uniatenas') };
    buildPayload(spec); // valida o simulado_id
    return Array.from({ length: copias }, () => ({ ...spec }));
  }
  if (!op.alunos?.length) throw new Error('o cartão sfa é pessoal: informe os alunos');
  return ordenarAlunos(op.alunos).map((a) => {
    const spec: CardSpec = {
      model: 'personalizado',
      ...base,
      ies: a.ies || op.ies || '',
      alunoNome: a.nome,
      userId: a.userId,
      label: rotuloDoCartao('personalizado', a.userId),
    };
    buildPayload(spec); // falha cedo se algum id não for UUID
    return spec;
  });
}

const cederFio = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Gera o PDF (uma página por cartão). Todos os cartões precisam ser do mesmo layout do template. */
export async function gerarPdf(
  template: CardTemplate,
  specs: CardSpec[],
  opcoes: OpcoesPdf = {},
  titulo = 'Cartões-resposta SFA',
): Promise<ArrayBuffer> {
  if (!specs.length) throw new Error('nenhum cartão para gerar');
  const { jsPDF } = await import('jspdf'); // carregado só quando alguém emite cartões
  const [largura, altura] = template.page_mm;
  const doc = new jsPDF({ unit: 'mm', format: [largura, altura], orientation: 'portrait', compress: true });
  doc.setProperties({ title: titulo, author: 'SanarFlix Academy', creator: 'cartao-omr (Academy)' });
  const ceder = opcoes.ceder ?? 4;
  for (let i = 0; i < specs.length; i++) {
    if (opcoes.shouldCancel?.()) throw new EmissaoCancelada();
    if (i > 0) doc.addPage([largura, altura], 'portrait');
    drawCard(doc, template, specs[i]!);
    opcoes.onProgress?.({ feitas: i + 1, total: specs.length });
    if (ceder > 0 && (i + 1) % ceder === 0) await cederFio();
  }
  return doc.output('arraybuffer');
}

/** Nome de arquivo seguro: `cartoes_<ies>_<simulado>.pdf`. */
export function nomeDoArquivo(ies: string, nomeSimulado: string): string {
  const limpo = (s: string): string =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40);
  const partes = [limpo(ies), limpo(nomeSimulado)].filter(Boolean);
  return `cartoes_${partes.join('_') || 'simulado'}.pdf`;
}
