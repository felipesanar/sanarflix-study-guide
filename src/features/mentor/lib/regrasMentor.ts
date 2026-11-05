/** Regras puras do handoff docs/05; cortes compartilhados pertencem ao Gestor. */
import {
  PROFICIENCIA_MINIMA, NIVEL_CRITICO_MAX, calcularVariacao, ehProficiente, nivelDesempenho,
} from '@/features/gestor/lib/regras';
import type {
  AlertaB2C, AlunoMentor, GrupoPrioridadeB2B, ItemPrioridade, PerfilB2B,
  Prevalencia, Sessao, StatusSessaoExibido, TemaTurma,
} from '../api/types';

export { PROFICIENCIA_MINIMA, NIVEL_CRITICO_MAX };

// TODO(P1): confirmar que o evento de origem é a última atividade de estudo.
export const DIAS_SUMIDO = 15;
export const DIAS_ESFRIANDO = 8;
export type Engajamento = 'ativo' | 'esfriando' | 'sumido';

export function diasSemAtividade(ultimaAtividade: string | null, hoje: Date): number | null {
  if (!ultimaAtividade) return null;
  const ms = hoje.getTime() - new Date(ultimaAtividade).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86_400_000)) : null;
}

/** Nunca acessou conta como sumido, sem inventar uma quantidade de dias. */
export function engajamento(dias: number | null): Engajamento {
  if (dias === null || dias >= DIAS_SUMIDO) return 'sumido';
  return dias >= DIAS_ESFRIANDO ? 'esfriando' : 'ativo';
}

export function vsCorte(acertoPct: number | null, cortePct: number | null): number | null {
  return calcularVariacao(cortePct, acertoPct);
}
export type SegmentoCorte = 'acima' | 'variacao' | 'abaixo' | 'sem_historico';
export function segmentoCorte(serieAcerto: (number | null)[], cortePct: number | null): SegmentoCorte {
  if (cortePct === null) return 'sem_historico';
  const pontos = serieAcerto.filter((v): v is number => v !== null);
  if (pontos.length < 2) return 'sem_historico';
  const acima = pontos.filter(v => v >= cortePct).length;
  return acima === pontos.length ? 'acima' : acima === 0 ? 'abaixo' : 'variacao';
}
export function situacaoCorte(acertoPct: number, cortePct: number): 'acima' | 'proximo' | 'longe' {
  if (acertoPct >= cortePct) return 'acima';
  return cortePct - acertoPct <= 3 ? 'proximo' : 'longe';
}

export const QUEDA_REGRESSAO_PP = 5;
export const VARIACAO_ESTAGNACAO_PP = 2;
interface EntradaAlerta {
  aluno: AlunoMentor;
  dias: number | null;
  serieAcerto: (number | null)[];
}
export function alertasDoAluno({ dias, serieAcerto }: EntradaAlerta, temSimulado: boolean): AlertaB2C[] {
  const out: AlertaB2C[] = [];
  const eng = engajamento(dias);
  if (eng === 'sumido') out.push('sumiram');
  if (!temSimulado) {
    if (eng === 'esfriando') out.push('esfriando');
    return out;
  }
  const ult = serieAcerto[serieAcerto.length - 1] ?? null;
  const pen = serieAcerto[serieAcerto.length - 2] ?? null;
  if (ult === null) out.push('nao_fizeram');
  const d = calcularVariacao(pen, ult);
  if (d !== null && d <= -QUEDA_REGRESSAO_PP) out.push('regrediram');
  const ult3 = serieAcerto.slice(-3);
  if (ult3.length === 3 && ult3.every((v): v is number => v !== null)) {
    if (Math.max(...ult3) - Math.min(...ult3) < VARIACAO_ESTAGNACAO_PP) out.push('estagnados');
  }
  return out;
}

const DEF_ALERTA: Record<AlertaB2C, Omit<ItemPrioridade<AlertaB2C>, 'alunoIds' | 'chave'>> = {
  sumiram: { titulo: 'Sumiram', criterio: `Sem acesso há ${DIAS_SUMIDO} dias ou mais`, prioridade: 'alta' },
  regrediram: { titulo: 'Regrediram', criterio: `Caíram ${QUEDA_REGRESSAO_PP} p.p. ou mais de acerto entre os 2 últimos simulados`, prioridade: 'alta' },
  estagnados: { titulo: 'Estagnados', criterio: `Variação menor que ${VARIACAO_ESTAGNACAO_PP} p.p. nos 3 últimos simulados`, prioridade: 'media' },
  nao_fizeram: { titulo: 'Não fizeram o simulado', criterio: 'Simulado mais recente já fechado', prioridade: 'media' },
  esfriando: { titulo: 'Esfriando', criterio: `Sem acesso entre ${DIAS_ESFRIANDO} e ${DIAS_SUMIDO - 1} dias`, prioridade: 'media' },
};
const ORDEM_ALERTA: AlertaB2C[] = ['sumiram', 'regrediram', 'estagnados', 'nao_fizeram', 'esfriando'];
export function prioridadesB2C(entradas: EntradaAlerta[], temSimulado: boolean): ItemPrioridade<AlertaB2C>[] {
  const mapa = new Map<AlertaB2C, string[]>();
  for (const e of entradas) {
    for (const a of alertasDoAluno(e, temSimulado)) mapa.set(a, [...(mapa.get(a) ?? []), e.aluno.id]);
  }
  return ORDEM_ALERTA.filter(k => mapa.has(k)).map(k => ({ chave: k, ...DEF_ALERTA[k], alunoIds: mapa.get(k)! }));
}

// TODO(P4): validar faixa 52–59 com a coordenação pedagógica.
export const VIRADA_MIN = 52;
export const MUITO_BAIXO_MAX = 45;
export const MUITO_BOM_MIN = 70;
export function perfilB2B(serieProf: (number | null)[]): PerfilB2B | null {
  const ult = serieProf[serieProf.length - 1] ?? null;
  const pen = serieProf[serieProf.length - 2] ?? null;
  if (ult === null) return null;
  const queda = calcularVariacao(pen, ult);
  if (ult < MUITO_BAIXO_MAX || (queda !== null && queda <= -QUEDA_REGRESSAO_PP)) return 'muito_baixo';
  if (!ehProficiente(ult) && ult >= VIRADA_MIN) return 'virada';
  if (pen !== null && ult >= MUITO_BOM_MIN && pen >= MUITO_BOM_MIN) return 'muito_bom';
  return null;
}
const DEF_PERFIL: Record<GrupoPrioridadeB2B, Omit<ItemPrioridade<GrupoPrioridadeB2B>, 'alunoIds' | 'chave'>> = {
  virada: { titulo: 'Potencial de virada', criterio: `Proficiência ${VIRADA_MIN}–${PROFICIENCIA_MINIMA - 1} no último simulado`, prioridade: 'alta' },
  muito_baixo: { titulo: 'Desempenho muito baixo', criterio: `Proficiência abaixo de ${MUITO_BAIXO_MAX} ou queda de ${QUEDA_REGRESSAO_PP}+`, prioridade: 'alta' },
  sem_acesso: { titulo: 'Sem acesso recente', criterio: `Sem acesso há ${DIAS_SUMIDO}+ dias`, prioridade: 'media' },
  muito_bom: { titulo: 'Desempenho muito bom', criterio: `Proficiência ${MUITO_BOM_MIN}+ nos 2 últimos`, prioridade: 'baixa' },
};
const ORDEM_PERFIL: GrupoPrioridadeB2B[] = ['virada', 'muito_baixo', 'sem_acesso', 'muito_bom'];
export function prioridadesB2B(alunos: { id: string; serieProf: (number | null)[]; dias: number | null }[]): ItemPrioridade<GrupoPrioridadeB2B>[] {
  const mapa = new Map<GrupoPrioridadeB2B, string[]>(ORDEM_PERFIL.map(k => [k, []]));
  for (const a of alunos) {
    const p = perfilB2B(a.serieProf);
    if (p) mapa.get(p)!.push(a.id);
    if (engajamento(a.dias) === 'sumido') mapa.get('sem_acesso')!.push(a.id);
  }
  return ORDEM_PERFIL.filter(k => mapa.get(k)!.length > 0).map(k => ({ chave: k, ...DEF_PERFIL[k], alunoIds: mapa.get(k)! }));
}

export const AMOSTRA_MINIMA_TEMA = 30;
export const PESO_PREVALENCIA: Record<Prevalencia, number> = { alta: 3, media: 2, baixa: 1 };
export const FATIA_PROVA: Record<Prevalencia, number> = { alta: 62, media: 28, baixa: 10 };
export type OrdemTemas = 'impacto' | 'acerto' | 'alunos';
export function impactoTema(t: Pick<TemaTurma, 'prevalencia' | 'acertoPct'>): number | null {
  return t.acertoPct === null ? null : PESO_PREVALENCIA[t.prevalencia] * (100 - t.acertoPct);
}
export function filtrarTemasCriticos(temas: TemaTurma[], modalidade: 'b2c' | 'b2b', area: string | null): TemaTurma[] {
  return temas.filter(t => t.respostas >= AMOSTRA_MINIMA_TEMA &&
    (modalidade === 'b2c' || (t.acertoPct !== null && t.acertoPct < NIVEL_CRITICO_MAX)) &&
    (area === null || t.grandeArea === area));
}
export function ordenarTemas(temas: TemaTurma[], ordem: OrdemTemas): TemaTurma[] {
  return [...temas].sort((a, b) => {
    if (ordem === 'alunos') return b.alunosAbaixo50 - a.alunosAbaixo50;
    const va = ordem === 'acerto' ? a.acertoPct : impactoTema(a);
    const vb = ordem === 'acerto' ? b.acertoPct : impactoTema(b);
    if (va === null) return vb === null ? 0 : 1;
    if (vb === null) return -1;
    return ordem === 'acerto' ? va - vb : vb - va;
  });
}
export const PASSO_TEMAS = 5;
// TODO(P3): validar régua B2C 78/66; B2B permanece na régua do Gestor.
export type ReguaMatriz = 'b2c' | 'gestor';
export function tomCelula(acertoPct: number | null, regua: ReguaMatriz): 'bom' | 'medio' | 'ruim' | null {
  if (acertoPct === null) return null;
  if (regua === 'b2c') return acertoPct >= 78 ? 'bom' : acertoPct >= 66 ? 'medio' : 'ruim';
  const nivel = nivelDesempenho(acertoPct);
  return nivel === 'excelente' ? 'bom' : nivel === 'mediano' ? 'medio' : 'ruim';
}

export function statusSessao(s: Sessao): StatusSessaoExibido {
  if (s.status === 'realizada') return 'realizada';
  const faltaLink = s.tipo !== 'individual' && !s.link;
  const pautaPendente = s.tipo === 'oficina' && !s.tema && s.pauta.length === 0;
  if (faltaLink && pautaPendente) return 'falta_link_e_pauta';
  if (faltaLink) return 'falta_link';
  return pautaPendente ? 'pauta_pendente' : 'agendada';
}
export function coletivasNoMes(sessoes: Sessao[], dataIso: string): number {
  return sessoes.filter(s => s.tipo !== 'individual' && s.data.startsWith(dataIso.slice(0, 7))).length;
}
export function ordenarSessoes(sessoes: Sessao[], aba: 'proximas' | 'realizadas'): Sessao[] {
  const alvo = sessoes.filter(s => s.status === (aba === 'proximas' ? 'agendada' : 'realizada'));
  const chave = (s: Sessao) => `${s.data}T${s.hora}`;
  return alvo.sort((a, b) => aba === 'proximas' ? chave(a).localeCompare(chave(b)) : chave(b).localeCompare(chave(a)));
}
export function saudacao(agora: Date): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const h = agora.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
