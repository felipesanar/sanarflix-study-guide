/**
 * Funções puras do Engajamento SanarFlix (spec 2026-10-22-engajamento §10.3).
 *
 * Períodos, ciclos, recência, meses e formatadores. Nada aqui lê rede, URL ou
 * relógio escondido: quem precisa de "hoje" recebe a data por parâmetro (ou usa
 * `hojeSaoPaulo()` explicitamente), para o teste fixar o dia.
 *
 * Datas são sempre `'AAAA-MM-DD'` (data-calendário de America/Sao_Paulo). A
 * aritmética usa UTC sobre os componentes da data, nunca `new Date('AAAA-MM-DD')`
 * em fuso local: meia-noite UTC cai no dia anterior em UTC-3.
 */
import { TRACO } from './rotulos';
import { formatNumero } from './formatters';

export type OpcaoPeriodo = '6m' | '30d' | 'letivo' | 'custom';
export type OpcaoPeriodoAdmin = '6m' | '30d' | 'ano';
export type TipoConteudo = 'todos' | 'video' | 'document';
export type Ciclo = 'basico' | 'clinico' | 'internato';

/** Primeira data com dado nas fontes de questões (CHECK de `response_date`). */
export const DATA_MINIMA = '2025-01-01';
/** Máximo de dias, inclusive, de um período personalizado (a RPC aceita `fim − inicio ≤ 730`). */
export const DIAS_MAXIMOS = 731;

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_EXTENSO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CICLO_TEXTO: Record<Ciclo, string> = { basico: 'básico', clinico: 'clínico', internato: 'internato' };

const DIA_MS = 24 * 60 * 60 * 1000;

/** `'AAAA-MM-DD'` → ms em UTC; `null` se não for uma data-calendário real (ex.: 2026-02-30). */
function paraMs(data: string | null | undefined): number | null {
  if (typeof data !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(ano, mes - 1, dia);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return ms;
}

function deMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** Hoje em America/Sao_Paulo, `'AAAA-MM-DD'`. */
export function hojeSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** Primeiro dia do semestre letivo corrente (1º/jan ou 1º/jul), a partir de `hoje`. */
function inicioDoSemestreLetivo(hoje: string): string {
  const [ano, mes] = hoje.split('-').map(Number);
  return `${ano}-${mes <= 6 ? '01' : '07'}-01`;
}

/**
 * P1/P2. Datas inclusivas.
 *
 * - `'6m'`: 1º dia de (mês de hoje − 5) → hoje.
 * - `'30d'`: hoje − 29 → hoje.
 * - `'letivo'`: 01/01 ou 01/07 do semestre corrente → hoje.
 * - `'ano'`: 01/01 → hoje.
 * - `'custom'`: [de, ate] validado (≥ 2025-01-01, ≤ hoje, de ≤ ate, ≤ 731 dias);
 *   inválido → `'6m'` (`opcaoEfetiva` diz o que de fato foi usado).
 */
export function calcularPeriodo(
  opcao: OpcaoPeriodo | OpcaoPeriodoAdmin,
  hoje: string,
  de?: string | null,
  ate?: string | null,
): { inicio: string; fim: string; opcaoEfetiva: string } {
  const hojeMs = paraMs(hoje);
  if (hojeMs === null) throw new Error(`calcularPeriodo: "hoje" inválido (${hoje})`);

  const seisMeses = () => {
    const [ano, mes] = hoje.split('-').map(Number);
    const total = ano * 12 + (mes - 1) - 5;
    const anoInicio = Math.floor(total / 12);
    const mesInicio = (total % 12) + 1;
    return { inicio: `${anoInicio}-${doisDigitos(mesInicio)}-01`, fim: hoje, opcaoEfetiva: '6m' };
  };

  switch (opcao) {
    case '30d':
      return { inicio: deMs(hojeMs - 29 * DIA_MS), fim: hoje, opcaoEfetiva: '30d' };
    case 'letivo':
      return { inicio: inicioDoSemestreLetivo(hoje), fim: hoje, opcaoEfetiva: 'letivo' };
    case 'ano':
      return { inicio: `${hoje.slice(0, 4)}-01-01`, fim: hoje, opcaoEfetiva: 'ano' };
    case 'custom': {
      const deMsVal = paraMs(de);
      const ateMs = paraMs(ate);
      const minimoMs = paraMs(DATA_MINIMA) as number;
      const valido =
        deMsVal !== null &&
        ateMs !== null &&
        deMsVal <= ateMs &&
        deMsVal >= minimoMs &&
        ateMs <= hojeMs &&
        (ateMs - deMsVal) / DIA_MS + 1 <= DIAS_MAXIMOS;
      return valido
        ? { inicio: de as string, fim: ate as string, opcaoEfetiva: 'custom' }
        : seisMeses();
    }
    case '6m':
    default:
      return seisMeses();
  }
}

/** `"Semestre letivo 2026.2"` para hoje = 2026-10-22. */
export function rotuloSemestreLetivo(hoje: string): string {
  const [ano, mes] = hoje.split('-').map(Number);
  return `Semestre letivo ${ano}.${mes <= 6 ? 1 : 2}`;
}

/**
 * Opção de período em minúsculas, para frases como "{IES} · últimos 6 meses" (§12.2).
 * "Personalizado…" vira "personalizado" (sem as reticências do seletor).
 */
export function rotuloPeriodoMinusculo(opcao: string, hoje: string): string {
  if (opcao === '6m') return 'últimos 6 meses';
  if (opcao === '30d') return 'últimos 30 dias';
  if (opcao === 'letivo') return rotuloSemestreLetivo(hoje).toLowerCase();
  return 'personalizado';
}

/** D15: 1–4 básico, 5–8 clínico, 9–12 internato. */
export function cicloDoSemestre(n: number): Ciclo {
  if (n <= 4) return 'basico';
  if (n <= 8) return 'clinico';
  return 'internato';
}

/** `"8º semestre · clínico"`. */
export function rotuloOpcaoSemestre(n: number): string {
  return `${n}º semestre · ${CICLO_TEXTO[cicloDoSemestre(n)]}`;
}

/** `"hoje"` (0), `"ontem"` (1), `"há N dias"` (≥ 2), `"nunca"` (null). */
export function rotuloRecencia(diasSemAtividade: number | null): string {
  if (diasSemAtividade === null) return 'nunca';
  if (diasSemAtividade <= 0) return 'hoje';
  if (diasSemAtividade === 1) return 'ontem';
  return `há ${diasSemAtividade} dias`;
}

function indiceDoMes(mes: string): number {
  const m = /^(\d{4})-(\d{2})/.exec(mes);
  return m ? Number(m[2]) - 1 : -1;
}

/** `'2026-09'` → `'set/26'`. */
export function mesAno(mes: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(mes);
  if (!m) return TRACO;
  return `${MESES_CURTO[Number(m[2]) - 1].toLowerCase()}/${m[1].slice(2)}`;
}

/** `'2026-09'` → `'Set'`; com `parcial` → `'Set*'`. */
export function mesCurto(mes: string, parcial = false): string {
  const i = indiceDoMes(mes);
  if (i < 0) return TRACO;
  return `${MESES_CURTO[i]}${parcial ? '*' : ''}`;
}

/** `'2026-10'` → `'Outubro'`. */
export function mesExtenso(mes: string): string {
  const i = indiceDoMes(mes);
  return i < 0 ? TRACO : MESES_EXTENSO[i];
}

/** `'2026-10-22'` → `'22/10'`. */
export function diaMes(data: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(data);
  return m ? `${m[2]}/${m[1]}` : TRACO;
}

/** Primeiro nome, para textos como "Dias em que Ana teve…". */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

/** Percentual com 1 casa e vírgula: `56.68` → `"56,7%"`; null → traço. */
export function pct1(v: number | null): string {
  if (v === null) return TRACO;
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Decimal com 1 casa e vírgula: `42.15` → `"42,2"`; null → traço. */
export function dec1(v: number | null): string {
  if (v === null) return TRACO;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Compacto do admin: < 100.000 por extenso (`"98.765"`), ≥ 100.000 em mil
 * (`"261 mil"`), ≥ 1.000.000 em milhões (`"1,3 mi"`).
 */
export function compacto(v: number): string {
  if (v >= 1_000_000 || Math.round(v / 1000) >= 1000) {
    return `${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  }
  if (v >= 100_000) return `${Math.round(v / 1000)} mil`;
  return formatNumero(v);
}

/**
 * D10. Diferença de uma TAXA em pontos percentuais, 0 casas:
 * `"▲ 6 p.p."`, `"▼ 3 p.p."`, `"= 0 p.p."`. Sem um dos lados, sem texto (nunca um número inventado).
 */
export function deltaPp(atual: number | null, anterior: number | null): string | null {
  if (atual === null || anterior === null) return null;
  const d = Math.round(atual - anterior);
  if (d > 0) return `▲ ${d} p.p.`;
  if (d < 0) return `▼ ${Math.abs(d)} p.p.`;
  return '= 0 p.p.';
}

/**
 * D10. Variação percentual de um TOTAL: `"+14%"`, `"−8%"` (sinal de menos real),
 * `"0%"`. Anterior nulo ou zero não tem base de comparação: sem texto (nunca "+∞%").
 */
export function deltaPct(atual: number, anterior: number | null): string | null {
  if (anterior === null || anterior === 0) return null;
  const p = Math.round(((atual - anterior) / anterior) * 100);
  if (p > 0) return `+${p}%`;
  if (p < 0) return `−${Math.abs(p)}%`;
  return '0%';
}

/** Rótulo do período anterior: `'6m'` → "6 meses anteriores"; `'30d'` → "30 dias anteriores"; demais → "{N} dias anteriores". */
export function rotuloPeriodoAnterior(opcao: string, dias: number): string {
  if (opcao === '6m') return '6 meses anteriores';
  if (opcao === '30d') return '30 dias anteriores';
  return `${dias} dias anteriores`;
}

export interface DetalheAtividadeTexto {
  dia: string;
  tipo: 'questoes' | 'video' | 'documento';
  especialidade: string | null;
}

/** `"02/08 · Questões de Cardiologia"` a partir de `eng_detalhe_atividade`; null → "nenhuma atividade registrada". */
export function textoDetalhe(detalhe: DetalheAtividadeTexto | null): string {
  if (detalhe === null) return 'nenhuma atividade registrada';
  const base = { questoes: 'Questões', video: 'Vídeo', documento: 'Documento' }[detalhe.tipo];
  const quando = diaMes(detalhe.dia);
  return detalhe.especialidade ? `${quando} · ${base} de ${detalhe.especialidade}` : `${quando} · ${base}`;
}

/**
 * `"22/10/2026, 06:02"` — data e hora de um instante ISO no fuso de America/Sao_Paulo
 * (o "atualizado em" do cabeçalho, §12.1). `null` ou ISO inválido → `null`: o chamador
 * diz "atualização pendente", nunca inventa um horário.
 *
 * Compõe a string a partir das partes em vez de confiar no separador do locale
 * (ICU recente troca ", " por " " entre data e hora).
 */
export function formatarAtualizadoEm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  const pega = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${pega('day')}/${pega('month')}/${pega('year')}, ${pega('hour')}:${pega('minute')}`;
}

/** Iniciais para o avatar: 1ª letra do primeiro e do último nome ("Ana Clara Ribeiro" → "AR"). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

/** Nome da IES para nome de arquivo: minúsculo, sem acento, espaços →  (§10.7). */
export function slugIes(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
}

/** Busca no front (filtro local de listas já carregadas): minúsculo e sem acento. */
export function normalizarBusca(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
