/**
 * Regras puras da tela Canais (B2B · docs/03 § Tela 5): rotina do grupo de WhatsApp, link do grupo
 * e rodízio do banco de pérolas. Datas de calendário em `YYYY-MM-DD` (America/Sao_Paulo).
 */
import { ehLinkHttps } from '../../lib/linkSeguro';
import type { ItemRotinaAcademy, Perola } from '../../api/types';

type Dia = ItemRotinaAcademy['dia'];

/** Rótulo de cada slot da rotina (protótipo B2B, `ROTINA[].label`). */
export const ROTULO_ROTINA: Record<ItemRotinaAcademy['tipo'], string> = {
  enquete: 'Enquete / desafio de imagem',
  resposta: 'Resposta + comentário do mentor',
  perola: 'Pérola de conhecimento',
};
const OFFSET: Record<Dia, number> = { ter: 1, qui: 3, sex: 4 };
const NOME_DIA: Record<Dia, string> = { ter: 'Terça', qui: 'Quinta', sex: 'Sexta' };

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function dataDoDia(semana: string, dia: Dia): string {
  return somarDias(semana, OFFSET[dia]);
}

export function ddmm(data: string): string {
  const [, m, d] = data.split('-');
  return d && m ? `${d}/${m}` : '';
}

/** "12 a 16/10" (segunda a sexta); com virada de mês, "28/09 a 02/10". */
export function intervaloSemana(semana: string): string {
  const sexta = somarDias(semana, 4);
  const [, mIni, dIni] = semana.split('-');
  return mIni === sexta.split('-')[1] ? `${dIni} a ${ddmm(sexta)}` : `${ddmm(semana)} a ${ddmm(sexta)}`;
}

export type SituacaoRotina = 'enviado' | 'hoje' | 'atrasado' | 'amanha' | 'futuro';

export function situacaoItem(item: Pick<ItemRotinaAcademy, 'semana' | 'dia' | 'enviadoEm'>, hoje: string): SituacaoRotina {
  if (item.enviadoEm) return 'enviado';
  const data = dataDoDia(item.semana, item.dia);
  if (data === hoje) return 'hoje';
  if (data < hoje) return 'atrasado';
  return data === somarDias(hoje, 1) ? 'amanha' : 'futuro';
}

export function rotuloSituacao(s: SituacaoRotina, dia: Dia): string {
  switch (s) {
    case 'enviado': return 'Enviado';
    case 'hoje': return 'Pendente · hoje';
    case 'atrasado': return 'Pendente';
    case 'amanha': return 'Amanhã';
    default: return `Na ${NOME_DIA[dia].toLowerCase()}`;
  }
}

/** "Marcar como enviado" só no dia ou depois (protótipo: nunca no slot de amanhã). */
export function podeMarcar(s: SituacaoRotina): boolean {
  return s === 'hoje' || s === 'atrasado';
}

export function rotuloDiaLongo(item: Pick<ItemRotinaAcademy, 'semana' | 'dia'>, s: SituacaoRotina): string {
  return `${NOME_DIA[item.dia]}, ${ddmm(dataDoDia(item.semana, item.dia))}${s === 'hoje' ? ' · hoje' : ''}`;
}

// ─── Link do grupo da turma ─────────────────────────────────────────────────

/** Convite `chat.whatsapp.com/…` (com ou sem `https://`) → URL https; qualquer outra coisa → null. */
export function normalizarLinkGrupo(bruto: string): string | null {
  const v = bruto.trim();
  if (!v) return null;
  const url = /^chat\.whatsapp\.com\//i.test(v) ? `https://${v}` : v;
  if (!ehLinkHttps(url)) return null;
  const u = new URL(url);
  if (u.hostname.toLowerCase() !== 'chat.whatsapp.com' || u.pathname.replace(/\//g, '').length === 0) return null;
  return url;
}

// ─── Banco de pérolas · rodízio ─────────────────────────────────────────────

export interface LinhaRodizio {
  id: string;
  semana: string | null;
  mentor: string | null;
  /** dd/mm */
  noMuralEm: string | null;
  tema: string | null;
  ehVoce: boolean;
  situacao: string | null;
}

/** Prazo para o mentor da vez propor a pérola antes de ela ir ao mural. TODO(contrato-perolas): confirmar regra. */
export const DIAS_PRAZO_PEROLA = 3;
const RODIZIO = /^Semana\s+(\d+)\s*·\s*(.+?)\s*·\s*no mural em\s*(\d{2})\/(\d{2})\s*$/i;
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** dd/mm sem ano → data no ano corrente, ou no seguinte quando já ficou mais de 6 meses para trás. */
function dataSemAno(dia: string, mes: string, hoje: string): string {
  const ano = Number(hoje.slice(0, 4));
  const candidata = `${ano}-${mes}-${dia}`;
  return candidata < somarDias(hoje, -183) ? `${ano + 1}-${mes}-${dia}` : candidata;
}

/**
 * TODO(contrato-perolas): `mentor_perolas_listar` devolve só `{ texto, tema, criado_em }` das pérolas do
 * próprio mentor; o rodízio (semana, mentor responsável, data no mural, todos os mentores) ainda não
 * tem campo. Enquanto isso, lê o formato "Semana N · Mentor · no mural em dd/mm" do texto; a pérola
 * fora desse formato aparece sem semana, mentor e data (nunca inventados).
 */
export function linhasRodizio(perolas: Perola[], mentorNome: string | null | undefined, hoje: string): LinhaRodizio[] {
  const eu = mentorNome ? semAcento(mentorNome) : null;
  const linhas = perolas.map((p) => {
    const m = RODIZIO.exec(p.texto.trim());
    if (!m) return { id: p.id, semana: null, mentor: null, noMuralEm: null, data: null, tema: p.tema ?? (p.texto.trim() || null), ehVoce: false };
    const [, semana, mentor, dia, mes] = m;
    return { id: p.id, semana, mentor, noMuralEm: `${dia}/${mes}`, data: dataSemAno(dia, mes, hoje), tema: p.tema, ehVoce: eu != null && semAcento(mentor) === eu };
  });
  linhas.sort((a, b) => (a.semana == null ? 1 : 0) - (b.semana == null ? 1 : 0) || Number(a.semana ?? 0) - Number(b.semana ?? 0));
  const futuras = linhas.filter((l) => l.data != null && l.data >= hoje);
  const proxima = futuras[0]?.id ?? null;
  const minha = futuras.find((l) => l.ehVoce)?.id ?? null;
  return linhas.map(({ data, ...l }) => ({
    ...l,
    situacao: l.id === minha && data ? `Sua vez · propor até ${ddmm(somarDias(data, -DIAS_PRAZO_PEROLA))}` : l.id === proxima ? 'Próxima no mural' : null,
  }));
}
