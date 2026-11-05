/**
 * Regras de apresentação do drawer do aluno (docs/02 e docs/03 § Drawer · Aluno).
 * Formatação numérica e rótulos compartilhados vêm do Gestor; aqui ficam só os textos do drawer.
 * `null` nunca vira zero: sem dado → `TRACO`.
 */
import { formatData, formatPct, TRACO } from '@/features/gestor/lib/formatters';
import { dataHoraSp, textoDoEvento } from '../../api/fonteAcademy';
import type { IntervencaoResumo, LogAluno, PerfilB2B, StatusIntervencao, TipoIntervencao } from '../../api/types';
import type { SegmentoCorte } from '../../lib/regrasMentor';
import type { DendeIconName } from '@/features/gestor/components/icon-names';

export { TRACO };

/** Primeira letra do primeiro e do último nome. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return TRACO;
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return `${partes[0][0]}${ultima}`.toUpperCase();
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** "(79) 9 9104-5582" para celular com DDD; outros formatos saem como vieram. */
export function formatTelefone(telefone: string | null | undefined): string {
  const bruto = (telefone ?? '').trim();
  if (!bruto) return TRACO;
  const d = bruto.replace(/\D/g, '').replace(/^55(?=\d{11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** Data-calendário "2026-12-31" → "dez/26" (lê os dígitos, sem fuso). */
export function formatMesAno(valor: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(valor ?? '');
  if (!m) return TRACO;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${mes}/${m[1].slice(2)}` : TRACO;
}

/** Instante ISO → "dd/mm/aaaa" no fuso de São Paulo. */
export function formatDataSp(iso: string | null | undefined): string {
  if (!iso) return TRACO;
  const { data } = dataHoraSp(iso);
  return data ? formatData(data) : TRACO;
}

/** Instante ISO → "dd/mm" no fuso de São Paulo. */
export function formatDiaMesSp(iso: string | null | undefined): string {
  const completo = formatDataSp(iso);
  return completo === TRACO ? TRACO : completo.slice(0, 5);
}

/** "hoje" / "ontem" / "há N dias"; sem atividade conhecida → "sem dado". */
export function formatUltimoAcesso(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return 'sem dado';
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

/** Número inteiro do consumo; `null` → traço. */
export function formatContagem(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? TRACO : valor.toLocaleString('pt-BR');
}

/** Acerto em questões: sem questões feitas, o percentual não existe. */
export function formatAcertoQuestoes(pct: number | null | undefined, questoes: number | null | undefined): string {
  if (pct === null || pct === undefined || !questoes) return TRACO;
  return formatPct(Math.round(pct));
}

// ─── Segmento B2C (corte da meta) e perfil B2B ───────────────────────────────

export const ROTULO_SEGMENTO: Record<SegmentoCorte, string> = {
  acima: 'Acima do corte',
  variacao: 'Em variação',
  abaixo: 'Abaixo do corte',
  sem_historico: 'Sem histórico',
};

export const ROTULO_PERFIL: Record<PerfilB2B, string> = {
  virada: 'Potencial de virada',
  muito_baixo: 'Desempenho muito baixo',
  muito_bom: 'Desempenho muito bom',
};

/** Textos literais do protótipo B2B (captura b2b/06). */
export const ORIENTACAO_PERFIL: Record<PerfilB2B, string> = {
  virada: 'conversa individual e plano para o próximo simulado.',
  muito_baixo: 'entender o contexto e sinalizar à coordenação.',
  muito_bom: 'incentivo pontual.',
};

/** "Acima do corte · +3 p.p." / "Abaixo do corte · −8 p.p.". */
export function textoVsCorte(diferencaPp: number): string {
  const v = Math.round(diferencaPp);
  return v >= 0 ? `Acima do corte · +${v} p.p.` : `Abaixo do corte · −${Math.abs(v)} p.p.`;
}

// ─── Log de interações ───────────────────────────────────────────────────────

export type FiltroLog = 'tudo' | 'intervencoes' | 'mural';
export interface ItemLog {
  chave: string;
  icone: DendeIconName;
  texto: string;
  status: string | null;
  em: string;
  filtro: Exclude<FiltroLog, 'tudo'>;
}

export const ROTULO_STATUS: Record<StatusIntervencao, string> = { afazer: 'A fazer', andamento: 'Em andamento', feito: 'Feito' };
const ICONE_TIPO: Record<TipoIntervencao, DendeIconName> = { individual: 'account_circle', coletiva: 'groups', mensagem: 'campaign' };

/**
 * Eventos que já aparecem como card (com status atual) não se repetem como linha solta do log:
 * criação/mudança/comentário de intervenção, agenda liberada e sessão criada geram o card no servidor.
 */
const EVENTOS_DE_CARD = new Set([
  'intervencao_criada', 'intervencao_tema', 'intervencao_aluno', 'intervencao_status', 'status_alterado',
  'intervencao_comentario', 'agenda_liberada', 'sessao_criada',
]);
const ICONE_EVENTO: Record<string, DendeIconName> = {
  mural_publicado: 'campaign', whatsapp: 'whatsapp', agenda_desligada: 'calendar_month',
  sessao_realizada: 'calendar_month', sessao_excluida: 'calendar_month', sinalizacao_ies: 'school',
};

/**
 * Log do aluno: cards de intervenção (com o status de agora) + eventos avulsos (mural, WhatsApp,
 * agenda desligada, sessão, sinalização), do mais recente ao mais antigo. Cards de mensagem do mural
 * ficam de fora porque o evento `mural_publicado` já os representa.
 */
export function montarLog(intervencoes: IntervencaoResumo[], log: LogAluno[]): ItemLog[] {
  const cards: ItemLog[] = intervencoes
    .filter((i) => i.tipo !== 'mensagem')
    .map((i) => ({ chave: `card-${i.id}`, icone: ICONE_TIPO[i.tipo], texto: i.titulo, status: ROTULO_STATUS[i.status], em: i.criadaEm, filtro: 'intervencoes' }));
  const eventos: ItemLog[] = log
    .filter((e) => !EVENTOS_DE_CARD.has(e.tipo))
    .map((e, i) => {
      const tag = e.tipo === 'mural_publicado' && typeof e.payload?.tag === 'string' && !e.payload?.texto ? e.payload.tag : null;
      const texto = textoDoEvento(e.tipo, e.payload ?? {});
      return {
        chave: `evento-${e.tipo}-${e.em}-${i}`,
        icone: ICONE_EVENTO[e.tipo] ?? 'info',
        texto: tag ? `${texto} · ${tag}` : texto,
        status: null,
        em: e.em,
        filtro: e.tipo === 'mural_publicado' ? 'mural' : 'intervencoes',
      };
    });
  const instante = (iso: string) => { const t = new Date(iso).getTime(); return Number.isFinite(t) ? t : 0; };
  return [...cards, ...eventos].sort((a, b) => instante(b.em) - instante(a.em));
}
