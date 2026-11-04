/**
 * Derivações puras do Início (docs/handoff/mentor/docs/02 § Tela 1 e 03 § Tela 1).
 * Regras e cortes vêm de `lib/regrasMentor` (que reexporta o Gestor); formatação, do Gestor.
 * `null` nunca vira zero: valor ausente sai como "—" e a comparação some sem 2 pontos válidos.
 */
import { formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';
import { dataHoraSp } from '../../api/fonteAcademy';
import type {
  AlertaB2C, AlunoB2b, AlunoTurmaAcademy, DesempenhoTurmaB2c, EngajamentoAluno, GrupoPrioridadeB2B, Intervencao,
  ItemPrioridade, ItemRotinaAcademy, PontoSerie, PontoSerieTurma, Sessao, SimuladoMentor, StatusSessaoExibido, VisaoGeralB2b,
} from '../../api/types';
import {
  DIAS_ESFRIANDO, DIAS_SUMIDO, MUITO_BAIXO_MAX, MUITO_BOM_MIN, PROFICIENCIA_MINIMA, QUEDA_REGRESSAO_PP,
  VARIACAO_ESTAGNACAO_PP, VIRADA_MIN, engajamento, ordenarSessoes,
} from '../../lib/regrasMentor';
import { calcularVariacao } from '@/features/gestor/lib/regras';

// ─── Formatação ─────────────────────────────────────────────────────────────

export type TomComparacao = 'positivo' | 'negativo' | 'neutro';
export interface Comparacao { texto: string; tom: TomComparacao }

/** "+6 p.p. vs 4º simulado" · "−9 vs semana anterior" · "igual ao 3º simulado". `null` → sem linha. */
export function textoComparacao(delta: number | null, unidade: string, referencia: string, igual = `igual ao ${referencia}`): Comparacao | null {
  if (delta === null) return null;
  if (delta === 0) return { texto: igual, tom: 'neutro' };
  const n = formatNumero(Math.abs(delta));
  return delta > 0 ? { texto: `+${n}${unidade} vs ${referencia}`, tom: 'positivo' } : { texto: `−${n}${unidade} vs ${referencia}`, tom: 'negativo' };
}

/** "19:00" → "19h"; "18:30" → "18h30". */
export function horaCurta(hora: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora ?? '');
  if (!m) return TRACO;
  const h = String(Number(m[1]));
  return m[2] === '00' ? `${h}h` : `${h}h${m[2]}`;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
const ehDataPura = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Data-calendário em São Paulo (YYYY-MM-DD); data pura é lida como veio, sem reinterpretar fuso. */
export function dataSp(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (ehDataPura(valor)) return valor;
  return dataHoraSp(valor).data || null;
}
/** "2026-10-16" → "Sex". */
export function diaSemanaCurto(data: string): string {
  const d = new Date(`${data.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? TRACO : DIAS_SEMANA[d.getUTCDay()];
}
/** dd/mm no fuso de São Paulo; `null` quando não há data. */
export function diaMes(valor: string | null | undefined): string | null {
  const d = dataSp(valor);
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : null;
}
function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function diferencaDias(de: string, ate: string): number {
  return Math.round((new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86_400_000);
}

/** Iniciais do primeiro e do último nome (avatares da lista de prioridades). */
export function iniciaisDe(nome: string | null | undefined, email: string): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return email.slice(0, 2).toUpperCase();
  const ini = partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[partes.length - 1][0];
  return ini.toUpperCase();
}

const ordinal = (ordem: number | null | undefined) => (ordem == null ? null : `${ordem}º`);

// ─── Indicadores (visão geral resumida) ─────────────────────────────────────

export interface IndicadorResumo {
  id: string;
  rotulo: string;
  valor: string;
  sufixo?: string;
  comparacao: Comparacao | null;
  /** Valor em cor de perigo (engajamento: "Sem acesso há 15+ dias"). */
  destaque?: 'perigo';
  /** Projeção (marcador tracejado "Projetado"). */
  projetado?: boolean;
}
export interface ResumoVisaoGeral { referencia: string | null; simuladoId: string | null; itens: IndicadorResumo[] }

const informativo = (texto: string): Comparacao => ({ texto, tom: 'neutro' });

/** B2C com simulado: há simulado encerrado quando a participação do último aponta para um simulado. */
export function temSimuladoFechado(d: DesempenhoTurmaB2c | undefined): boolean {
  return !!d?.participacaoUltimo.simuladoId;
}
function simuladoDe(simulados: SimuladoMentor[], id: string | null): SimuladoMentor | null {
  return id ? simulados.find((s) => s.id === id) ?? null : null;
}

/** Ponto anterior válido (não nulo) da série fechada, antes do simulado de referência. */
function anteriorValido(serie: PontoSerieTurma[], refId: string, campo: 'acertoMedio' | 'acimaCortePct'): PontoSerieTurma | null {
  const fechados = serie.filter((p) => p.fechado).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const i = fechados.findIndex((p) => p.simuladoId === refId);
  if (i <= 0) return null;
  for (let j = i - 1; j >= 0; j--) if (fechados[j][campo] !== null) return fechados[j];
  return null;
}
function comparacaoSerie(atual: number | null, ant: PontoSerieTurma | null, campo: 'acertoMedio' | 'acimaCortePct'): Comparacao | null {
  if (!ant) return null;
  const ref = ordinal(ant.ordem) ?? ant.titulo;
  return ref ? textoComparacao(calcularVariacao(ant[campo], atual), ' p.p.', `${ref} simulado`) : null;
}

export function indicadoresB2c(d: DesempenhoTurmaB2c, serie: PontoSerieTurma[] | undefined): ResumoVisaoGeral {
  const refId = d.participacaoUltimo.simuladoId;
  const sim = simuladoDe(d.simulados, refId);
  const dm = diaMes(sim?.data);
  const referencia = sim ? (dm ? `${sim.nome} · ${dm}` : sim.nome) : null;
  const pontos = serie ?? [];
  const antCorte = refId ? anteriorValido(pontos, refId, 'acimaCortePct') : null;
  const antAcerto = refId ? anteriorValido(pontos, refId, 'acertoMedio') : null;
  const { fizeram, total } = d.participacaoUltimo;
  return {
    referencia,
    simuladoId: refId,
    itens: [
      { id: 'acima', rotulo: 'Acima do corte', valor: formatPct(d.possivelAprovacaoPct), comparacao: comparacaoSerie(d.possivelAprovacaoPct, antCorte, 'acimaCortePct') },
      { id: 'acerto', rotulo: 'Acerto médio', valor: formatPct(d.acertoMedioUltimo), comparacao: comparacaoSerie(d.acertoMedioUltimo, antAcerto, 'acertoMedio') },
      total > 0
        ? { id: 'participacao', rotulo: 'Participação', valor: String(fizeram), sufixo: `/ ${total}`, comparacao: informativo(`${total - fizeram} não fizeram`) }
        : { id: 'participacao', rotulo: 'Participação', valor: TRACO, comparacao: null },
    ],
  };
}

const ativoNaSemana = (s: EngajamentoAluno['semanas'][number] | undefined) => !!s && ((s.questoes ?? 0) > 0 || (s.conteudos ?? 0) > 0);

/**
 * V0 (sem simulado). "Ativos" = última atividade até 7 dias (mesmo corte do segmento da Turma).
 * "Semana anterior" = semana-calendário anterior (seg–dom) de `mentor_engajamento_turma`.
 */
export function indicadoresV0(turma: AlunoTurmaAcademy[], eng: EngajamentoAluno[] | undefined): ResumoVisaoGeral {
  const ativos = turma.filter((a) => engajamento(a.diasSemAtividade) === 'ativo');
  const sumidos = turma.filter((a) => engajamento(a.diasSemAtividade) === 'sumido').length;
  const comQuestoes = ativos.filter((a) => a.temDadoQuestoes && a.questoes7d.respondidas !== null);
  const questoesAtual = comQuestoes.length ? Math.round(comQuestoes.reduce((s, a) => s + (a.questoes7d.respondidas ?? 0), 0) / comQuestoes.length) : null;

  let ativosAnterior: number | null = null;
  let questoesAnterior: number | null = null;
  if (eng?.length) {
    const anteriores = eng.map((a) => a.semanas[a.semanas.length - 2]);
    const ativosAnt = anteriores.filter(ativoNaSemana);
    ativosAnterior = ativosAnt.length;
    const comQ = ativosAnt.filter((s) => s!.questoes !== null);
    questoesAnterior = comQ.length ? Math.round(comQ.reduce((s, x) => s + (x!.questoes ?? 0), 0) / comQ.length) : null;
  }
  const vsSemana = (delta: number | null) => textoComparacao(delta, '', 'semana anterior', 'igual à semana anterior');
  return {
    referencia: 'últimos 7 dias',
    simuladoId: null,
    itens: [
      {
        id: 'ativos', rotulo: 'Ativos na semana', valor: turma.length ? String(ativos.length) : TRACO, sufixo: turma.length ? `/ ${turma.length}` : undefined,
        comparacao: turma.length ? vsSemana(calcularVariacao(ativosAnterior, ativos.length)) : null,
      },
      { id: 'questoes', rotulo: 'Questões por aluno ativo', valor: questoesAtual === null ? TRACO : formatNumero(questoesAtual), comparacao: vsSemana(calcularVariacao(questoesAnterior, questoesAtual)) },
      { id: 'sumidos', rotulo: `Sem acesso há ${DIAS_SUMIDO}+ dias`, valor: String(sumidos), sufixo: 'alunos', comparacao: informativo('mesmo corte do alerta'), destaque: 'perigo' },
    ],
  };
}

/** B2B: comparação com o ponto válido anterior da série do indicador (último × penúltimo). */
function comparacaoIndicador(serie: PontoSerie[], unidade = ''): Comparacao | null {
  const validos = serie.filter((p) => p.valor !== null);
  if (validos.length < 2) return null;
  const [ant, atual] = validos.slice(-2);
  if (serie[serie.length - 1]?.valor === null) return null;
  return textoComparacao(calcularVariacao(ant.valor, atual.valor), unidade, `${ant.rotulo} simulado`);
}

export function indicadoresB2b(v: VisaoGeralB2b): ResumoVisaoGeral {
  const sim = simuladoDe(v.simulados, v.simuladoReferenciaId);
  const dm = diaMes(sim?.data);
  const nome = sim ? (ordinal(sim.ordem) ? `${ordinal(sim.ordem)} simulado` : sim.nome) : null;
  const conceito = v.conceitoEnamed.valor;
  const tri = v.triProjetado.valor;
  return {
    referencia: nome ? (dm ? `${nome} · ${dm}` : nome) : null,
    simuladoId: v.simuladoReferenciaId,
    itens: [
      {
        id: 'conceito', rotulo: 'Conceito ENAMED previsto', projetado: true,
        valor: conceito === null ? TRACO : String(Math.round(conceito)), sufixo: conceito === null ? undefined : '/ 5',
        comparacao: conceito === null ? null : comparacaoIndicador(v.conceitoEnamed.serie),
      },
      {
        id: 'tri', rotulo: 'TRI projetado', projetado: true,
        valor: formatNumero(tri), sufixo: tri === null ? undefined : '/ 100',
        comparacao: tri === null ? null : comparacaoIndicador(v.triProjetado.serie),
      },
      {
        id: 'proficientes', rotulo: 'Alunos proficientes', valor: formatPct(v.proficientesPct.valor),
        comparacao: v.proficientes !== null && v.participantes !== null ? informativo(`${v.proficientes} de ${v.participantes} participantes`) : null,
      },
    ],
  };
}

// ─── Prioridades ────────────────────────────────────────────────────────────

/** Sumiram primeiro quem está há mais tempo sem atividade (nunca acessou = topo). */
const porDiasDesc = (a: { diasSemAtividade: number | null }, b: { diasSemAtividade: number | null }) =>
  (b.diasSemAtividade ?? Number.POSITIVE_INFINITY) - (a.diasSemAtividade ?? Number.POSITIVE_INFINITY);

/**
 * Alertas do B2C. Com simulado: Sumiram, Regrediram, Estagnados, Não fizeram (flags do servidor, mesmas
 * regras de docs/05). V0: Sumiram e Esfriando. Grupo vazio fica na lista e a `ListaPrioridades` o esconde.
 */
export function alertasB2c(turma: AlunoTurmaAcademy[], d: DesempenhoTurmaB2c | undefined, comSimulado: boolean): ItemPrioridade<AlertaB2C>[] {
  const sumiram: ItemPrioridade<AlertaB2C> = {
    chave: 'sumiram', titulo: 'Sumiram', criterio: `Sem acesso há ${DIAS_SUMIDO} dias ou mais`, prioridade: 'alta',
    alunoIds: turma.filter((a) => engajamento(a.diasSemAtividade) === 'sumido').sort(porDiasDesc).map((a) => a.email),
  };
  if (!comSimulado || !d) {
    return [sumiram, {
      chave: 'esfriando', titulo: 'Esfriando', criterio: `Sem acesso entre ${DIAS_ESFRIANDO} e ${DIAS_SUMIDO - 1} dias`, prioridade: 'media',
      alunoIds: turma.filter((a) => engajamento(a.diasSemAtividade) === 'esfriando').sort(porDiasDesc).map((a) => a.email),
    }];
  }
  const sim = simuladoDe(d.simulados, d.participacaoUltimo.simuladoId);
  const fechou = diaMes(sim?.data);
  return [
    sumiram,
    {
      chave: 'regrediram', titulo: 'Regrediram', criterio: `Caíram ${QUEDA_REGRESSAO_PP} p.p. ou mais de acerto entre os 2 últimos simulados`,
      prioridade: 'alta', alunoIds: d.alunos.filter((a) => a.regrediu).map((a) => a.email),
    },
    {
      chave: 'estagnados', titulo: 'Estagnados', criterio: `Variação menor que ${VARIACAO_ESTAGNACAO_PP} p.p. nos 3 últimos simulados`,
      prioridade: 'media', alunoIds: d.alunos.filter((a) => a.estagnado).map((a) => a.email),
    },
    {
      chave: 'nao_fizeram', titulo: sim?.ordem != null ? `Não fizeram o ${sim.ordem}º simulado` : 'Não fizeram o simulado',
      criterio: fechou ? `Simulado fechou em ${fechou}` : 'Simulado mais recente já fechado',
      prioridade: 'media', alunoIds: d.alunos.filter((a) => a.fezUltimo === false).map((a) => a.email),
    },
  ];
}

/** Prioridades do B2B: perfil calculado no servidor + "Sem acesso recente" (15+ dias, docs/05 D3). */
export function prioridadesB2bInicio(alunos: AlunoB2b[]): ItemPrioridade<GrupoPrioridadeB2B>[] {
  const de = (p: AlunoB2b['perfil']) => alunos.filter((a) => a.perfil === p).map((a) => a.email);
  return [
    { chave: 'virada', titulo: 'Potencial de virada', criterio: `Proficiência ${VIRADA_MIN}–${PROFICIENCIA_MINIMA - 1} no último simulado`, prioridade: 'alta', alunoIds: de('virada') },
    { chave: 'muito_baixo', titulo: 'Desempenho muito baixo', criterio: `Proficiência abaixo de ${MUITO_BAIXO_MAX} ou queda de ${QUEDA_REGRESSAO_PP}+`, prioridade: 'alta', alunoIds: de('muito_baixo') },
    {
      chave: 'sem_acesso', titulo: 'Sem acesso recente', criterio: `Sem acesso há ${DIAS_SUMIDO}+ dias`, prioridade: 'media',
      alunoIds: alunos.filter((a) => engajamento(a.diasSemAtividade) === 'sumido').sort(porDiasDesc).map((a) => a.email),
    },
    { chave: 'muito_bom', titulo: 'Desempenho muito bom', criterio: `Proficiência ${MUITO_BOM_MIN}+ nos 2 últimos`, prioridade: 'baixa', alunoIds: de('muito_bom') },
  ];
}

// ─── Sessões ────────────────────────────────────────────────────────────────

/** B2C: o próximo encontro em destaque + até 2 das demais. B2B: a próxima + as 2 seguintes (ordem cronológica). */
export function sessoesInicio(sessoes: Sessao[], modalidade: 'b2c' | 'b2b'): { destaque: Sessao | null; demais: Sessao[] } {
  const proximas = ordenarSessoes(sessoes, 'proximas');
  const destaque = modalidade === 'b2c' ? proximas.find((s) => s.tipo !== 'individual') ?? proximas[0] ?? null : proximas[0] ?? null;
  return { destaque, demais: proximas.filter((s) => s !== destaque).slice(0, 2) };
}

export interface StatusExibicao { rotulo: string; tom: 'neutro' | 'atencao' | 'positivo'; acao: string }
export const STATUS_SESSAO: Record<StatusSessaoExibido, StatusExibicao> = {
  agendada: { rotulo: 'Agendada', tom: 'neutro', acao: 'Abrir sessão' },
  falta_link: { rotulo: 'Falta link', tom: 'atencao', acao: 'Adicionar link' },
  pauta_pendente: { rotulo: 'Pauta pendente', tom: 'atencao', acao: 'Definir pauta' },
  falta_link_e_pauta: { rotulo: 'Falta link e pauta', tom: 'atencao', acao: 'Adicionar link' },
  realizada: { rotulo: 'Realizada', tom: 'positivo', acao: 'Abrir sessão' },
};
export const TIPO_SESSAO_CURTO: Record<Sessao['tipo'], string> = {
  encontro_tribo: 'Encontro da tribo', individual: 'Individual', pos_simulado: 'Pós-simulado', oficina: 'Oficina de questões',
};

// ─── Cards "A fazer" ────────────────────────────────────────────────────────

/** "Turma toda" · nome do aluno · "{grupo} · n alunos" · "n alunos". */
export function quemDoCard(c: Pick<Intervencao, 'destino'>, nomes: Map<string, string>): string {
  const ids = c.destino.alunoIds ?? [];
  if (c.destino.turmaToda) return 'Turma toda';
  const n = ids.length === 1 ? '1 aluno' : `${ids.length} alunos`;
  if (c.destino.grupo) return ids.length ? `${c.destino.grupo} · ${n}` : c.destino.grupo;
  if (ids.length === 1) return nomes.get(ids[0]) ?? ids[0];
  return ids.length ? n : TRACO;
}

// ─── Rotina do grupo (B2B) ──────────────────────────────────────────────────

export const ROTULO_ROTINA: Record<ItemRotinaAcademy['tipo'], string> = {
  enquete: 'Enquete / desafio de imagem',
  resposta: 'Resposta + comentário do mentor',
  perola: 'Pérola de conhecimento',
};
const OFFSET_DIA: Record<ItemRotinaAcademy['dia'], number> = { ter: 1, qui: 3, sex: 4 };

export interface ItemRotinaExibido {
  id: string;
  /** "Ter 13/10" */
  dia: string;
  rotulo: string;
  /** enviado · marcar (hoje ou atrasado) · futuro */
  estado: 'enviado' | 'marcar' | 'futuro';
  textoEstado: string | null;
}
/** `hoje` = data-calendário em São Paulo (YYYY-MM-DD). */
export function itensRotina(itens: ItemRotinaAcademy[], hoje: string): ItemRotinaExibido[] {
  return [...itens].sort((a, b) => OFFSET_DIA[a.dia] - OFFSET_DIA[b.dia]).map((r) => {
    const data = somarDias(r.semana, OFFSET_DIA[r.dia]);
    const dia = `${diaSemanaCurto(data)} ${data.slice(8, 10)}/${data.slice(5, 7)}`;
    if (r.enviadoEm) return { id: r.id, dia, rotulo: ROTULO_ROTINA[r.tipo], estado: 'enviado', textoEstado: 'Enviado' };
    const faltam = diferencaDias(hoje, data);
    if (faltam <= 0) return { id: r.id, dia, rotulo: ROTULO_ROTINA[r.tipo], estado: 'marcar', textoEstado: null };
    return { id: r.id, dia, rotulo: ROTULO_ROTINA[r.tipo], estado: 'futuro', textoEstado: faltam === 1 ? 'Amanhã' : `Em ${faltam} dias` };
  });
}
