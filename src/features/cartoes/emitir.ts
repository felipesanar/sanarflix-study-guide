/**
 * Emissão dos cartões-resposta: monta um PDF A4 (uma página por cartão) no navegador, a partir do
 * template. Nada sai do Academy: nem nome, nem matrícula, nem o PDF.
 *
 * Mesmas regras do `cartao-omr gerar-cartoes`: um cartão personalizado por aluno (nome e matrícula impressos,
 * matrícula também no QR; sem matrícula utilizável, o plano B: o QR leva o e-mail e o campo da matrícula fica em
 * branco para o aluno escrever), ordenado por nome sem considerar acentos; o cartão UniAtenas é um só, sem nome, repetido `copias` vezes.
 */
import {
  buildPayload,
  normalizarEmail,
  normalizarMatricula,
  problemaDaMatricula,
  problemaDoEmail,
  rotuloDoCartao,
} from './payload.ts';
import type { ProblemaEmail, ProblemaMatricula } from './payload.ts';
import { drawCard } from './render.ts';
import type { CardSpec, CardTemplate, LayoutCartao } from './types.ts';

export interface AlunoEmissao {
  nome: string;
  /** Matrícula/RA do cadastro: impressa no cartão e no QR (a importação casa por ela). */
  matricula?: string;
  /** Plano B: só quando o aluno não tem matrícula utilizável; o QR leva o e-mail e o campo da matrícula fica em branco. */
  email?: string;
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

/** Chave do aluno no cartão: a matrícula ou, no plano B, o e-mail. */
function chaveDoAluno(a: { matricula?: string | null; email?: string | null }): string {
  return normalizarMatricula(a.matricula) || normalizarEmail(a.email);
}

/** Ordena por nome sem considerar acentos; desempata pela matrícula ou e-mail (igual ao `roster.py`). */
export function ordenarAlunos<T extends { nome: string; matricula?: string | null; email?: string | null }>(alunos: T[]): T[] {
  return [...alunos].sort((a, b) => {
    const ka = chaveDeOrdem(a.nome);
    const kb = chaveDeOrdem(b.nome);
    if (ka !== kb) return ka < kb ? -1 : 1;
    const ia = chaveDoAluno(a);
    const ib = chaveDoAluno(b);
    return ia < ib ? -1 : ia > ib ? 1 : 0;
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

/** Monta o conteúdo variável de cada cartão (e valida a matrícula ou o e-mail, que vira o QR). */
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
  const vistas = new Set<string>();
  return ordenarAlunos(op.alunos).map((a) => {
    const mat = normalizarMatricula(a.matricula);
    const email = normalizarEmail(a.email);
    if (mat && email) throw new Error(`informe a matrícula ou o e-mail de ${a.nome}, não os dois`);
    const chave = mat || email;
    if (chave && vistas.has(chave)) throw new Error(`${mat ? 'matrícula repetida' : 'e-mail repetido'} na lista de alunos: ${chave}`);
    vistas.add(chave);
    const spec: CardSpec = {
      model: 'personalizado',
      ...base,
      ies: a.ies || op.ies || '',
      alunoNome: a.nome,
      ...(mat ? { matricula: mat } : { email }),
      label: rotuloDoCartao('personalizado', mat, email),
    };
    buildPayload(spec); // falha cedo se a matrícula ou o e-mail não puder ir no cartão
    return spec;
  });
}

/** Por que a matrícula não serve para o cartão (e o aluno cai no plano B, ou fora do PDF). */
export type MotivoSemMatricula = ProblemaMatricula | 'duplicada';
/** Por que o aluno ficou fora do PDF: não tem matrícula utilizável e o e-mail também não serve. */
export type MotivoExclusao = ProblemaEmail | 'email_duplicado';

export interface Identificacao {
  /** Como o cartão identifica o aluno: pela matrícula, ou (plano B) pelo e-mail. */
  via: 'matricula' | 'email';
  /** Só no plano B: por que a matrícula não foi usada. */
  motivoSemMatricula?: MotivoSemMatricula;
}

export interface ClassificacaoAlunos<T> {
  /** Recebem cartão: pela matrícula, quando é utilizável e única na IES; senão pelo e-mail. */
  aptos: Array<T & Identificacao>;
  /** Ficam fora do PDF: sem matrícula utilizável **e** sem e-mail utilizável. O cadastro precisa ser corrigido. */
  excluidos: Array<{ aluno: T; motivo: MotivoExclusao; motivoSemMatricula: MotivoSemMatricula }>;
}

/**
 * Separa quem recebe cartão e por qual identificação. Regra: matrícula utilizável (presente, no formato aceito e
 * única na IES) segue como sempre; os demais caem no plano B, o e-mail. Matrícula repetida (como os `99-G-99999`)
 * tira **todos** os envolvidos da matrícula: o cartão não diria de quem é a resposta. E-mail repetido ou inutilizável
 * deixa o aluno fora do PDF.
 */
export function classificarAlunos<T extends { matricula: string | null; email?: string | null }>(alunos: T[]): ClassificacaoAlunos<T> {
  const contaMatriculas = new Map<string, number>();
  const contaEmails = new Map<string, number>();
  for (const a of alunos) {
    const m = normalizarMatricula(a.matricula);
    if (m) contaMatriculas.set(m, (contaMatriculas.get(m) ?? 0) + 1);
    const e = normalizarEmail(a.email);
    if (e) contaEmails.set(e, (contaEmails.get(e) ?? 0) + 1);
  }
  const aptos: ClassificacaoAlunos<T>['aptos'] = [];
  const excluidos: ClassificacaoAlunos<T>['excluidos'] = [];
  for (const a of alunos) {
    const problemaMat = problemaDaMatricula(a.matricula);
    const repetida = (contaMatriculas.get(normalizarMatricula(a.matricula)) ?? 0) > 1;
    if (!problemaMat && !repetida) {
      aptos.push({ ...a, via: 'matricula' });
      continue;
    }
    const motivoSemMatricula: MotivoSemMatricula = problemaMat ?? 'duplicada';
    const problemaEmail = problemaDoEmail(a.email);
    if (problemaEmail) excluidos.push({ aluno: a, motivo: problemaEmail, motivoSemMatricula });
    else if ((contaEmails.get(normalizarEmail(a.email)) ?? 0) > 1) excluidos.push({ aluno: a, motivo: 'email_duplicado', motivoSemMatricula });
    else aptos.push({ ...a, via: 'email', motivoSemMatricula });
  }
  return { aptos, excluidos };
}

export const ROTULO_SEM_MATRICULA: Record<MotivoSemMatricula, string> = {
  sem_matricula: 'sem matrícula cadastrada',
  formato_nao_suportado: 'matrícula fora do formato aceito (A–Z, 0–9, . / -, até 24 caracteres)',
  duplicada: 'matrícula repetida no cadastro da IES',
};

export const ROTULO_EXCLUSAO: Record<MotivoExclusao, string> = {
  sem_email: 'sem e-mail cadastrado',
  email_invalido: 'e-mail inválido para o QR',
  email_longo_demais: 'e-mail com mais de 58 caracteres',
  email_duplicado: 'e-mail repetido no cadastro',
};

/** Texto único para a tela e o CSV: por que a matrícula não serve e por que o e-mail também não. */
export function descricaoDaExclusao(e: ClassificacaoAlunos<unknown>['excluidos'][number]): string {
  return `${ROTULO_SEM_MATRICULA[e.motivoSemMatricula]} / ${ROTULO_EXCLUSAO[e.motivo]}`;
}

function celulaCsv(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** CSV (`;`, UTF-8 com BOM, abre direto no Excel) dos alunos que ficaram fora, para o cadastro ser corrigido. */
export function csvDosExcluidos(
  excluidos: ClassificacaoAlunos<{ nome: string; matricula: string | null; email?: string | null; semestre?: number | null }>['excluidos'],
): string {
  const linhas = [
    ['nome', 'matricula', 'email', 'semestre', 'motivo'],
    ...excluidos.map((e) => [
      e.aluno.nome,
      e.aluno.matricula ?? '',
      e.aluno.email ?? '',
      e.aluno.semestre == null ? '' : String(e.aluno.semestre),
      descricaoDaExclusao(e),
    ]),
  ];
  return '\ufeff' + linhas.map((l) => l.map(celulaCsv).join(';')).join('\r\n') + '\r\n';
}

/**
 * CSV (`;`, BOM) do que foi emitido: é a `--lista` do `cartao-omr processar`. `identificacao` é a matrícula ou o
 * e-mail (o plano B), e `tipo` diz qual.
 */
export function csvDaEmissao(alunos: Array<{ nome: string; matricula?: string | null; email?: string | null }>): string {
  const linhas = [
    ['identificacao', 'tipo', 'nome'],
    ...ordenarAlunos(alunos).map((a) => {
      const mat = normalizarMatricula(a.matricula);
      return [mat || normalizarEmail(a.email), mat ? 'matricula' : 'email', a.nome];
    }),
  ];
  return '\ufeff' + linhas.map((l) => l.map(celulaCsv).join(';')).join('\r\n') + '\r\n';
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

/** Nome de arquivo seguro: `cartoes_<ies>_<simulado>[_sem-6-7].pdf` (o último trecho é o filtro de semestre). */
export function nomeDoArquivo(ies: string, nomeSimulado: string, sufixo = ''): string {
  const limpo = (s: string): string =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40);
  const partes = [limpo(ies), limpo(nomeSimulado), limpo(sufixo)].filter(Boolean);
  return `cartoes_${partes.join('_') || 'simulado'}.pdf`;
}
