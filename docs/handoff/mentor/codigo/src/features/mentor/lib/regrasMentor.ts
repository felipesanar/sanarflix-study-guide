/**
 * Regras de negócio do Portal do Mentor.
 *
 * Mesmo princípio de `features/gestor/lib/regras.ts`: nenhum componente
 * reimplementa corte, prioridade ou ordenação. Tudo que o protótipo calcula
 * na tela está aqui como função pura e testada (`regrasMentor.test.ts`).
 *
 * Cortes marcados "P#" dependem de validação (docs/05-decisoes-e-pendencias.md).
 */
import {
  PROFICIENCIA_MINIMA,
  NIVEL_CRITICO_MAX,
  calcularVariacao,
  ehProficiente,
} from '@/features/gestor/lib/regras';
import type {
  AlertaB2C,
  AlunoMentor,
  GrupoPrioridadeB2B,
  ItemPrioridade,
  PerfilB2B,
  Prevalencia,
  Sessao,
  StatusSessaoExibido,
  TemaTurma,
} from '../api/types';

export { PROFICIENCIA_MINIMA, NIVEL_CRITICO_MAX };

// ─── Engajamento ────────────────────────────────────────────────────────

/** D3: um único corte em todas as telas (o handoff tinha 10 na home e 15 na turma). */
export const DIAS_SUMIDO = 15;
export const DIAS_ESFRIANDO = 8;

export type Engajamento = 'ativo' | 'esfriando' | 'sumido';

export function diasSemAtividade(ultimaAtividade: string | null, hoje: Date): number | null {
  if (!ultimaAtividade) return null;
  const ms = hoje.getTime() - new Date(ultimaAtividade).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** `null` (nunca acessou) conta como sumido: não há atividade para mostrar. */
export function engajamento(dias: number | null): Engajamento {
  if (dias === null || dias >= DIAS_SUMIDO) return 'sumido';
  if (dias >= DIAS_ESFRIANDO) return 'esfriando';
  return 'ativo';
}

// ─── B2C: corte da meta ─────────────────────────────────────────────────

/** Diferença em p.p. entre o acerto e o corte da meta. `null` se faltar um lado. */
export function vsCorte(acertoPct: number | null, cortePct: number | null): number | null {
  return calcularVariacao(cortePct, acertoPct);
}

export type SegmentoCorte = 'acima' | 'variacao' | 'abaixo' | 'sem_historico';

/**
 * Segmento da Minha Turma: mesma lógica de `grupoEvolucao` do Gestor, trocando
 * o limiar fixo de 60 pelo corte da meta de cada aluno.
 */
export function segmentoCorte(serieAcerto: (number | null)[], cortePct: number | null): SegmentoCorte {
  if (cortePct === null) return 'sem_historico';
  const pontos = serieAcerto.filter((v): v is number => v !== null);
  if (pontos.length < 2) return 'sem_historico';
  const acima = pontos.filter((v) => v >= cortePct).length;
  if (acima === pontos.length) return 'acima';
  if (acima === 0) return 'abaixo';
  return 'variacao';
}

/** Visão de alunos do Detalhamento B2C. "Próximo" = até 3 p.p. abaixo do corte. */
export function situacaoCorte(acertoPct: number, cortePct: number): 'acima' | 'proximo' | 'longe' {
  if (acertoPct >= cortePct) return 'acima';
  if (cortePct - acertoPct <= 3) return 'proximo';
  return 'longe';
}

// ─── B2C: alertas ───────────────────────────────────────────────────────

export const QUEDA_REGRESSAO_PP = 5;
export const VARIACAO_ESTAGNACAO_PP = 2;

interface EntradaAlerta {
  aluno: AlunoMentor;
  dias: number | null;
  /** % de acerto por simulado realizado, do mais antigo ao mais recente. */
  serieAcerto: (number | null)[];
}

export function alertasDoAluno({ dias, serieAcerto }: EntradaAlerta, temSimulado: boolean): AlertaB2C[] {
  const out: AlertaB2C[] = [];
  const eng = engajamento(dias);
  if (eng === 'sumido') out.push('sumiram');
  if (!temSimulado) {
    if (eng === 'esfriando') out.push('esfriando');
    return out; // V0: só engajamento
  }
  const ult = serieAcerto[serieAcerto.length - 1] ?? null;
  const pen = serieAcerto[serieAcerto.length - 2] ?? null;
  if (ult === null) out.push('nao_fizeram');
  const d = calcularVariacao(pen, ult);
  if (d !== null && d <= -QUEDA_REGRESSAO_PP) out.push('regrediram');
  const ult3 = serieAcerto.slice(-3);
  if (ult3.length === 3 && ult3.every((v) => v !== null)) {
    const vals = ult3 as number[];
    if (Math.max(...vals) - Math.min(...vals) < VARIACAO_ESTAGNACAO_PP) out.push('estagnados');
  }
  return out;
}

const DEF_ALERTA: Record<AlertaB2C, Omit<ItemPrioridade<AlertaB2C>, 'alunoIds' | 'chave'>> = {
  sumiram: { titulo: 'Sumiram', criterio: `Sem acesso há ${DIAS_SUMIDO} dias ou mais`, prioridade: 'alta' },
  regrediram: {
    titulo: 'Regrediram',
    criterio: `Caíram ${QUEDA_REGRESSAO_PP} p.p. ou mais de acerto entre os 2 últimos simulados`,
    prioridade: 'alta',
  },
  estagnados: {
    titulo: 'Estagnados',
    criterio: `Variação menor que ${VARIACAO_ESTAGNACAO_PP} p.p. nos 3 últimos simulados`,
    prioridade: 'media',
  },
  nao_fizeram: { titulo: 'Não fizeram o simulado', criterio: 'Simulado mais recente já fechado', prioridade: 'media' },
  esfriando: { titulo: 'Esfriando', criterio: `Sem acesso entre ${DIAS_ESFRIANDO} e ${DIAS_SUMIDO - 1} dias`, prioridade: 'media' },
};

const ORDEM_ALERTA: AlertaB2C[] = ['sumiram', 'regrediram', 'estagnados', 'nao_fizeram', 'esfriando'];

/** Lista do Início B2C. Grupo sem aluno não aparece. Um aluno pode estar em vários. */
export function prioridadesB2C(entradas: EntradaAlerta[], temSimulado: boolean): ItemPrioridade<AlertaB2C>[] {
  const mapa = new Map<AlertaB2C, string[]>();
  for (const e of entradas) {
    for (const a of alertasDoAluno(e, temSimulado)) {
      mapa.set(a, [...(mapa.get(a) ?? []), e.aluno.id]);
    }
  }
  return ORDEM_ALERTA.filter((k) => mapa.has(k)).map((k) => ({ chave: k, ...DEF_ALERTA[k], alunoIds: mapa.get(k)! }));
}

// ─── B2B: perfis do planejamento pedagógico ─────────────────────────────

/** P4: faixa a validar com a coordenação pedagógica. */
export const VIRADA_MIN = 52;
export const MUITO_BAIXO_MAX = 45;
export const MUITO_BOM_MIN = 70;

export function perfilB2B(serieProf: (number | null)[]): PerfilB2B | null {
  const pontos = serieProf.filter((v): v is number => v !== null);
  if (pontos.length === 0) return null;
  const ult = pontos[pontos.length - 1];
  const pen = pontos.length > 1 ? pontos[pontos.length - 2] : null;
  const queda = pen !== null ? ult - pen : 0;
  if (ult < MUITO_BAIXO_MAX || queda <= -QUEDA_REGRESSAO_PP) return 'muito_baixo';
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

/** Ordem fixa do planejamento: virada primeiro. */
const ORDEM_PERFIL: GrupoPrioridadeB2B[] = ['virada', 'muito_baixo', 'sem_acesso', 'muito_bom'];

export function prioridadesB2B(
  alunos: { id: string; serieProf: (number | null)[]; dias: number | null }[],
): ItemPrioridade<GrupoPrioridadeB2B>[] {
  const mapa = new Map<GrupoPrioridadeB2B, string[]>(ORDEM_PERFIL.map((k) => [k, []]));
  for (const a of alunos) {
    const p = perfilB2B(a.serieProf);
    if (p) mapa.get(p)!.push(a.id);
    if (engajamento(a.dias) === 'sumido') mapa.get('sem_acesso')!.push(a.id);
  }
  return ORDEM_PERFIL.map((k) => ({ chave: k, ...DEF_PERFIL[k], alunoIds: mapa.get(k)! }));
}

// ─── Temas críticos ─────────────────────────────────────────────────────

export const AMOSTRA_MINIMA_TEMA = 30;
export const PESO_PREVALENCIA: Record<Prevalencia, number> = { alta: 3, media: 2, baixa: 1 };
/** Fatia de cada faixa na prova (taxonomia ENAMED). */
export const FATIA_PROVA: Record<Prevalencia, number> = { alta: 62, media: 28, baixa: 10 };

export type OrdemTemas = 'impacto' | 'acerto' | 'alunos';

export function impactoTema(t: Pick<TemaTurma, 'prevalencia' | 'acertoPct'>): number {
  return PESO_PREVALENCIA[t.prevalencia] * (100 - t.acertoPct);
}

/**
 * Entrada na lista: amostra mínima sempre; no B2B, acerto abaixo do corte
 * crítico do Gestor (50). No B2C a lista mostra todos os temas com amostra,
 * ordenados (a régua do B2C é outra, ver P3).
 */
export function filtrarTemasCriticos(temas: TemaTurma[], modalidade: 'b2c' | 'b2b', area: string | null): TemaTurma[] {
  return temas.filter(
    (t) =>
      t.respostas >= AMOSTRA_MINIMA_TEMA &&
      (modalidade === 'b2c' || t.acertoPct < NIVEL_CRITICO_MAX) &&
      (area === null || t.grandeArea === area),
  );
}

export function ordenarTemas(temas: TemaTurma[], ordem: OrdemTemas): TemaTurma[] {
  const copia = [...temas];
  if (ordem === 'acerto') return copia.sort((a, b) => a.acertoPct - b.acertoPct);
  if (ordem === 'alunos') return copia.sort((a, b) => b.alunosAbaixo50 - a.alunosAbaixo50);
  return copia.sort((a, b) => impactoTema(b) - impactoTema(a));
}

/** Passo de expansão do componente (pedido do Léo: além dos 5). */
export const PASSO_TEMAS = 5;

// ─── Matriz de prevalência ──────────────────────────────────────────────

/** P3: B2C usa 78/66 (handoff); B2B usa a régua do Gestor (50/80). */
export type ReguaMatriz = 'b2c' | 'gestor';

export function tomCelula(acertoPct: number | null, regua: ReguaMatriz): 'bom' | 'medio' | 'ruim' | null {
  if (acertoPct === null) return null;
  if (regua === 'b2c') return acertoPct >= 78 ? 'bom' : acertoPct >= 66 ? 'medio' : 'ruim';
  return acertoPct >= 80 ? 'bom' : acertoPct >= NIVEL_CRITICO_MAX ? 'medio' : 'ruim';
}

// ─── Sessões ────────────────────────────────────────────────────────────

export function statusSessao(s: Sessao): StatusSessaoExibido {
  if (s.status === 'realizada') return 'realizada';
  const coletiva = s.tipo !== 'individual';
  const faltaLink = coletiva && !s.link;
  const pautaPendente = s.tipo === 'oficina' && !s.tema && s.pauta.length === 0;
  if (faltaLink && pautaPendente) return 'falta_link_e_pauta';
  if (faltaLink) return 'falta_link';
  if (pautaPendente) return 'pauta_pendente';
  return 'agendada';
}

/** Coletivas já marcadas no mês da data (YYYY-MM-DD), para o aviso de excesso do contrato. */
export function coletivasNoMes(sessoes: Sessao[], dataIso: string): number {
  const mes = dataIso.slice(0, 7);
  return sessoes.filter((s) => s.tipo !== 'individual' && s.data.startsWith(mes)).length;
}

export function ordenarSessoes(sessoes: Sessao[], aba: 'proximas' | 'realizadas'): Sessao[] {
  const alvo = sessoes.filter((s) => (aba === 'proximas' ? s.status === 'agendada' : s.status === 'realizada'));
  const chave = (s: Sessao) => `${s.data}T${s.hora}`;
  return alvo.sort((a, b) => (aba === 'proximas' ? chave(a).localeCompare(chave(b)) : chave(b).localeCompare(chave(a))));
}

// ─── Saudação ───────────────────────────────────────────────────────────

export function saudacao(agora: Date): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const h = agora.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
