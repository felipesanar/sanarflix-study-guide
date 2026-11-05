/**
 * Regras de apresentação da tela Sessões (docs/02 § Tela 5, docs/03 § Tela 4, docs/07 § Estados).
 * O status exibido vem SEMPRE de `statusSessao` (lib/regrasMentor); aqui só se normaliza o tema
 * (o protótipo grava "Tema a definir" quando o mentor não informou tema) e se formata o que a tela mostra.
 */
import type { NovaSessao } from '../../api/fonte';
import { dataHoraSp } from '../../api/fonteAcademy';
import type { ItemPauta, Sessao, StatusSessaoExibido, TipoSessao } from '../../api/types';
import { ehLinkHttps } from '../../lib/linkSeguro';
import { coletivasNoMes, statusSessao } from '../../lib/regrasMentor';
import { campoParaIso } from '../sessoes/dataHora';

export const TEMA_A_DEFINIR = 'Tema a definir';
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ORDINAIS = ['primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava', 'nona', 'décima'];

export const ehColetiva = (t: TipoSessao) => t !== 'individual';

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' → 'Sex'. */
export function diaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? '—' : DIAS_SEMANA[d.getUTCDay()];
}
/** 'YYYY-MM-DD' → '16/10'. */
export function ddmm(data: string): string {
  const [, m, d] = data.split('-');
  return d && m ? `${d}/${m}` : '—';
}
/** 'HH:MM' → '19h' / '19h30'. */
export function rotuloHora(hora: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!m) return '—';
  return `${Number(m[1])}h${m[2] === '00' ? '' : m[2]}`;
}

/** Hoje em São Paulo ('YYYY-MM-DD'). */
export function hojeSp(agora: Date = new Date()): string {
  return dataHoraSp(agora.toISOString()).data;
}

/** "dd/mm" → próxima ocorrência ('YYYY-MM-DD', hoje incluso). Data inválida → null. */
export function lerData(valor: string, agora: Date = new Date()): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(valor.trim());
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const hoje = hojeSp(agora);
  const anoHoje = Number(hoje.slice(0, 4));
  for (const ano of [anoHoje, anoHoje + 1]) {
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
    const iso = `${ano}-${pad(mes)}-${pad(dia)}`;
    if (iso >= hoje) return iso;
  }
  return null;
}

/** "19h", "19:30", "19h30", "19" → 'HH:MM'. Inválida → null. */
export function lerHora(valor: string): string | null {
  const m = /^(\d{1,2})(?:\s*(?:h|:)\s*(\d{2})?)?\s*h?$/i.exec(valor.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** Data e hora de São Paulo → ISO UTC (mesma regra de `dataHora.campoParaIso`). */
export function montarInicio(data: string, hora: string): string {
  return campoParaIso(`${data}T${hora}`);
}

/** Link colado pelo mentor → https normalizado, ou null se não for um link https válido. */
export function normalizarLink(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  const comProtocolo = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  if (!ehLinkHttps(comProtocolo)) return null;
  const host = new URL(comProtocolo).hostname;
  return host.includes('.') ? comProtocolo : null;
}
/** Link sem o protocolo, como o protótipo mostra. */
export function linkExibido(url: string): string {
  return url.replace(/^https?:\/\//i, '');
}

/** Tema informado pelo mentor (vazio e "Tema a definir" contam como sem tema). */
export function temaReal(s: Pick<Sessao, 'tema'>): string | null {
  const t = s.tema?.trim();
  return !t || t.toLowerCase() === TEMA_A_DEFINIR.toLowerCase() ? null : t;
}
/** Status exibido: `statusSessao` da base sobre o tema normalizado. */
export function paraStatus(s: Sessao): StatusSessaoExibido {
  return statusSessao({ ...s, tema: temaReal(s) });
}
/** Docs/05 § CRUD: só sessão futura e agendada pode ser excluída. */
export function podeExcluir(s: Sessao, agora: Date = new Date()): boolean {
  return s.status === 'agendada' && !!s.inicio && new Date(s.inicio).getTime() > agora.getTime();
}

/** Subtítulo da linha B2B (sem número fixo; descrição gravada tem prioridade). */
export function subtituloB2b(s: Sessao, alunoNome: string | null, agendaLiberada: boolean): string {
  const desc = s.descricao?.trim();
  if (desc) return desc;
  if (s.tipo === 'individual') return alunoNome ? `${alunoNome}${agendaLiberada ? ' · agenda liberada' : ''}` : '—';
  if (s.tipo === 'oficina') {
    return !temaReal(s) && s.pauta.length === 0 ? 'escolha a partir dos temas críticos' : '5 pré-teste → comentário → ficha → 5 pós';
  }
  return s.pauta.some((p) => p.origem === 'mais_erradas') ? 'pauta gerada do Detalhamento' : 'as 20 mais erradas e os distratores';
}

export interface ItemCiclo { chave: 'atual' | 'proximo'; texto: string; completo: boolean }
/** Faixa de ciclo do contrato B2B. Sem `encontrosPorMes` cadastrado, não há meta para mostrar. */
// TODO(P13): tipos e quantidade por contrato (USCS tem regra própria).
export function cicloContrato(sessoes: Sessao[], encontrosPorMes: number | null | undefined, agora: Date = new Date()): ItemCiclo[] {
  if (!encontrosPorMes || encontrosPorMes <= 0) return [];
  const hoje = hojeSp(agora);
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  const atual = `${ano}-${pad(mes)}`;
  const prox = mes === 12 ? `${ano + 1}-01` : `${ano}-${pad(mes + 1)}`;
  const coletivas = sessoes.filter((s) => ehColetiva(s.tipo));
  const realizados = coletivas.filter((s) => s.data.startsWith(atual) && s.status === 'realizada').length;
  const agendados = coletivas.filter((s) => s.data.startsWith(prox)).length;
  return [
    { chave: 'atual', texto: `${MESES_ABREV[mes - 1]}: ${realizados} de ${encontrosPorMes} realizados`, completo: realizados >= encontrosPorMes },
    { chave: 'proximo', texto: `${MESES_ABREV[Number(prox.slice(5, 7)) - 1]}: ${agendados} de ${encontrosPorMes} agendados`, completo: agendados >= encontrosPorMes },
  ];
}

/** Aviso (não bloqueia) quando o mês da nova sessão coletiva já tem as sessões do contrato. */
export function avisoContrato(sessoes: Sessao[], data: string | null, encontrosPorMes: number | null | undefined, iesNome: string | null | undefined): string | null {
  if (!data || !encontrosPorMes || encontrosPorMes <= 0) return null;
  const n = coletivasNoMes(sessoes, data);
  if (n < encontrosPorMes) return null;
  const ordinal = ORDINAIS[n] ?? `${n + 1}ª`;
  const contrato = iesNome ? `O contrato da ${iesNome} prevê` : 'O contrato prevê';
  return `Já há ${n} sessões coletivas neste mês. ${contrato} ${encontrosPorMes}; uma ${ordinal} não conta no ciclo.`;
}

/** Pauta no formato de escrita da fonte (ordem renumerada). */
export function pautaParaSalvar(itens: ItemPauta[]): NonNullable<NovaSessao['pauta']> {
  return itens.map((p, ordem) => ({ texto: p.texto, origem: p.origem, referenciaId: p.referenciaId ?? undefined, ordem }));
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p));
  if (!partes.length) return '—';
  const sel = partes.length === 1 ? [partes[0]] : [partes[0], partes[partes.length - 1]];
  return sel.map((p) => p[0]).join('').toUpperCase();
}
