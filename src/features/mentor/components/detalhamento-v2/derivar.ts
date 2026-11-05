/**
 * Regras puras do Detalhamento por Simulados (docs/02 e docs/03 § Tela 3). Nada aqui inventa número:
 * `null` = sem dado, fica fora das médias e vira "—" na tela.
 */
import type { Alternativa, AlunoNoSimulado, ItemCronograma } from '@/features/gestor/api/types';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import type {
  AlunoB2b,
  AlunoTurmaAcademy,
  DesempenhoTurmaB2c,
  Prevalencia,
  PontoSerieTurma,
  QuestaoMentor,
  QuestaoResumoMentor,
  SimuladoMentor,
} from '@/features/mentor/api/types';
import { VIRADA_MIN, situacaoCorte } from '@/features/mentor/lib/regrasMentor';
import { semPrefixoAlternativa, textoSeguro } from '@/features/mentor/lib/textoSeguro';

// ─── Simulados e seleção (?s=) ──────────────────────────────────────────────

export const curto = (ordem: number) => `${ordem}º`;
export const disponivel = (s: SimuladoMentor) => s.status === 'realizado';
const porOrdem = (a: SimuladoMentor, b: SimuladoMentor) => a.ordem - b.ordem;

/** Padrão ao entrar: os 2 mais recentes com resultado (4º+5º no B2C, 3º+4º no B2B). */
export function selecaoPadrao(simulados: SimuladoMentor[]): string[] {
  return simulados.filter(disponivel).sort(porOrdem).slice(-2).map((s) => s.id);
}

/**
 * `?s=` ausente = padrão; presente e vazio = o mentor limpou (erro "Escolha ao menos um simulado").
 * Cada item pode ser a ordem (deep link legível: `?s=4,5`) ou o id. Indisponíveis e lixo são ignorados.
 */
export function lerParamSimulados(param: string | null, simulados: SimuladoMentor[]): string[] {
  if (param === null) return selecaoPadrao(simulados);
  const ids = new Set<string>();
  for (const bruto of param.split(',')) {
    const t = bruto.trim();
    if (!t) continue;
    const alvo = /^\d+$/.test(t) ? simulados.find((s) => s.ordem === Number(t)) : simulados.find((s) => s.id === t);
    if (alvo && disponivel(alvo)) ids.add(alvo.id);
  }
  return simulados.filter((s) => ids.has(s.id)).sort(porOrdem).map((s) => s.id);
}

export function escreverParamSimulados(ids: string[], simulados: SimuladoMentor[]): string {
  return simulados.filter((s) => ids.includes(s.id)).sort(porOrdem).map((s) => String(s.ordem)).join(',');
}

export function simuladosDoRecorte(ids: string[], simulados: SimuladoMentor[]): SimuladoMentor[] {
  return simulados.filter((s) => ids.includes(s.id)).sort(porOrdem);
}

/** "4º e 5º" · "3º, 4º e 5º". */
export function rotuloRecorte(sel: SimuladoMentor[]): string {
  const r = sel.map((s) => curto(s.ordem));
  return r.length <= 1 ? r.join('') : `${r.slice(0, -1).join(', ')} e ${r[r.length - 1]}`;
}

const MOTIVO: Partial<Record<SimuladoMentor['status'], string>> = {
  agendado: 'Ainda não realizado',
  previsto: 'Previsto, sem data',
  processando: 'Em processamento',
};

/** Simulados do mentor no formato do `SeletorSimulados` do Gestor (motivos com os textos do protótipo). */
export function itensSeletor(simulados: SimuladoMentor[]): ItemCronograma[] {
  return [...simulados].sort(porOrdem).map((s) => ({
    id: s.id,
    nome: s.nome || `${curto(s.ordem)} Simulado`,
    data: s.data,
    status: s.status === 'processando' ? 'processing' : s.status,
    modalidade: null,
    participantes: s.status === 'realizado' ? s.participantes : null,
    indisponivelPorque: MOTIVO[s.status] ?? null,
  }));
}

// ─── Média ──────────────────────────────────────────────────────────────────

/** Média ponderada; itens com valor null ou peso ≤ 0 ficam fora. Sem nenhum válido = null. */
export function mediaPonderada(itens: { valor: number | null; peso: number }[]): number | null {
  let soma = 0;
  let pesos = 0;
  for (const { valor, peso } of itens) {
    if (valor === null || !(peso > 0)) continue;
    soma += valor * peso;
    pesos += peso;
  }
  return pesos > 0 ? Math.round((soma / pesos) * 10) / 10 : null;
}

// ─── Matriz grande área × prevalência ───────────────────────────────────────

export const PREVALENCIAS: Prevalencia[] = ['alta', 'media', 'baixa'];
export interface TemaMatriz { grandeArea: string; prevalencia: Prevalencia | null; acertoPct: number | null; respostas: number }
export interface MatrizPrevalencia {
  /** false = `enamed_prevalencia_tema` vazia para o recorte: estado "Prevalência ainda não cadastrada". */
  temPrevalencia: boolean;
  colunas: Record<Prevalencia, number | null>;
  linhas: { area: string; celulas: Record<Prevalencia, number | null> }[];
}

export function matrizPrevalencia(temas: TemaMatriz[], ordemAreas: string[]): MatrizPrevalencia {
  const comPrev = temas.filter((t) => t.prevalencia !== null);
  const celula = (area: string | null, p: Prevalencia) =>
    mediaPonderada(comPrev.filter((t) => t.prevalencia === p && (area === null || t.grandeArea === area))
      .map((t) => ({ valor: t.acertoPct, peso: t.respostas })));
  const areas = [...ordemAreas, ...temas.map((t) => t.grandeArea).filter((a) => !ordemAreas.includes(a))]
    .filter((a, i, l) => l.indexOf(a) === i);
  return {
    temPrevalencia: comPrev.length > 0,
    colunas: { alta: celula(null, 'alta'), media: celula(null, 'media'), baixa: celula(null, 'baixa') },
    linhas: areas.map((area) => ({ area, celulas: { alta: celula(area, 'alta'), media: celula(area, 'media'), baixa: celula(area, 'baixa') } })),
  };
}

const chaveTema = (area: string, tema: string) => `${area}|${tema}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/**
 * B2B: o detalhamento por simulado não traz prevalência; ela é atributo do tema (`enamed_prevalencia_tema`),
 * então vem do dicionário de temas da turma e é cruzada por grande área + tema.
 */
export function temasComPrevalencia(
  areas: { grandeArea: string; temas: { tema: string; acertoPct: number | null; respostas: number }[] }[],
  dicionario: { grandeArea: string; tema: string; prevalencia: Prevalencia | null }[],
): TemaMatriz[] {
  const mapa = new Map(dicionario.map((d) => [chaveTema(d.grandeArea, d.tema), d.prevalencia]));
  return areas.flatMap((a) => a.temas.map((t) => ({
    grandeArea: a.grandeArea, prevalencia: mapa.get(chaveTema(a.grandeArea, t.tema)) ?? null, acertoPct: t.acertoPct, respostas: t.respostas,
  })));
}

// ─── Indicadores ────────────────────────────────────────────────────────────

export interface PorSimuladoKpi {
  rotulo: string;
  participacao: number | null;
  possivelAprovacaoPct: number | null;
  conceito: number | null;
  proficienciaMedia: number | null;
  proficientesPct: number | null;
}

export function kpisB2c(sel: SimuladoMentor[], serie: PontoSerieTurma[], desempenho: DesempenhoTurmaB2c | undefined) {
  const pontos = sel.map((s) => ({ s, p: serie.find((x) => x.simuladoId === s.id) ?? null }));
  const ids = new Set(sel.map((s) => s.id));
  return {
    acertoMedio: mediaPonderada(pontos.map(({ p }) => ({ valor: p?.acertoMedio ?? null, peso: p?.participantes ?? 0 }))),
    participantes: desempenho ? desempenho.alunos.filter((a) => a.notas.some((n) => ids.has(n.simuladoId) && n.acertoPct !== null)).length : null,
    totalTurma: desempenho ? desempenho.participacaoUltimo.total : null,
    porSimulado: pontos.map(({ s, p }): PorSimuladoKpi => ({
      rotulo: curto(s.ordem), participacao: p ? p.participantes : null, possivelAprovacaoPct: p?.acimaCortePct ?? null,
      conceito: null, proficienciaMedia: null, proficientesPct: null,
    })),
  };
}

/** B2B: a série dos indicadores projetados casa por posição; sem série completa, só o último ponto é afirmado. */
export function porSimuladoB2b(
  sel: SimuladoMentor[],
  conceito: { valor: number | null; delta: number | null; serie: { valor: number | null }[] } | undefined,
  tri: { valor: number | null; delta: number | null; serie: { valor: number | null }[] } | undefined,
  proficientesPct: number | null,
): PorSimuladoKpi[] {
  const ponto = (ind: typeof conceito, i: number): number | null => {
    if (!ind) return null;
    if (ind.serie.length === sel.length) return ind.serie[i]?.valor ?? null;
    if (i === sel.length - 1) return ind.valor;
    if (i === sel.length - 2 && ind.valor !== null && ind.delta !== null) return Math.round((ind.valor - ind.delta) * 10) / 10;
    return null;
  };
  return sel.map((s, i) => ({
    rotulo: curto(s.ordem), participacao: null, possivelAprovacaoPct: null,
    conceito: ponto(conceito, i), proficienciaMedia: ponto(tri, i), proficientesPct: i === sel.length - 1 ? proficientesPct : null,
  }));
}

// ─── Visão de alunos ────────────────────────────────────────────────────────

export function rotuloUltimoAcesso(dias: number | null): string {
  if (dias === null) return '—';
  if (dias <= 0) return 'hoje';
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

export type SituacaoMetaLinha = 'acima' | 'proximo' | 'longe' | 'sem_meta';
export interface AlunoVisaoB2c extends AlunoNoSimulado {
  acertoPct: number | null;
  corte: number | null;
  situacaoMeta: SituacaoMetaLinha | null;
  ultimoAcesso: string;
}

/** B2C: linha calculada no simulado mais recente do recorte; semestre nunca aparece (docs/05 § Ajustes). */
export function alunosVisaoB2c(
  desempenho: DesempenhoTurmaB2c | undefined,
  turma: Pick<AlunoTurmaAcademy, 'email' | 'diasSemAtividade'>[] | undefined,
  ultimoId: string | null,
): AlunoVisaoB2c[] {
  if (!desempenho) return [];
  const dias = new Map((turma ?? []).map((t) => [t.email, t.diasSemAtividade]));
  return desempenho.alunos.map((a) => {
    const nota = a.notas.find((n) => n.simuladoId === ultimoId)?.acertoPct ?? null;
    const participou = nota !== null;
    const corte = a.corteMaisDificil ?? null;
    return {
      id: a.email,
      nome: a.nome ?? a.email,
      semestre: null,
      participou,
      acertos: null,
      proficiencia: null,
      situacao: participou ? 'abaixo_do_limiar' : 'nao_participou',
      acertoPct: nota,
      corte,
      situacaoMeta: !participou ? null : corte === null ? 'sem_meta' : situacaoCorte(nota, corte),
      ultimoAcesso: rotuloUltimoAcesso(dias.get(a.email) ?? null),
    } as AlunoVisaoB2c;
  });
}

export type FaixaB2b = 'proficiente' | 'virada' | 'abaixo';
export interface AlunoVisaoB2b extends AlunoNoSimulado { acertoPct: number | null; faixa: FaixaB2b | null }

export function faixaB2b(proficiencia: number | null): FaixaB2b | null {
  if (proficiencia === null) return null;
  if (proficiencia >= PROFICIENCIA_MINIMA) return 'proficiente';
  return proficiencia >= VIRADA_MIN ? 'virada' : 'abaixo';
}

/** B2B: proficiência do último simulado do recorte; acerto só quando esse é o último simulado do aluno. */
export function alunosVisaoB2b(alunos: AlunoB2b[] | undefined, ultimoId: string | null): AlunoVisaoB2b[] {
  return (alunos ?? []).map((a) => {
    const proficiencia = a.proficiencias.find((p) => p.simuladoId === ultimoId)?.valor ?? null;
    const ultimoDoAluno = [...a.proficiencias].reverse().find((p) => p.valor !== null);
    const participou = proficiencia !== null;
    return {
      id: a.email,
      nome: a.nome ?? a.email,
      semestre: a.semestre,
      participou,
      acertos: null,
      proficiencia,
      situacao: !participou ? 'nao_participou' : proficiencia >= PROFICIENCIA_MINIMA ? 'proficiente' : 'abaixo_do_limiar',
      acertoPct: participou && ultimoDoAluno?.simuladoId === ultimoId ? a.acertoUltimoPct : null,
      faixa: faixaB2b(proficiencia),
    } as AlunoVisaoB2b;
  });
}

// ─── Questões ───────────────────────────────────────────────────────────────

export type OrdemQuestoes = 'prova' | 'erradas' | 'acertadas';

/** Lista de questões do simulado mais recente do recorte, filtrada por área e ordenada (null sempre no fim). */
export function questoesDoRecorte(
  questoes: QuestaoResumoMentor[],
  ordemSimulado: number | null,
  area: string | null,
  ordem: OrdemQuestoes,
): QuestaoResumoMentor[] {
  const doSimulado = questoes.filter((q) => ordemSimulado === null || q.ordem === null || q.ordem === ordemSimulado);
  const filtradas = area ? doSimulado.filter((q) => q.grandeArea === area) : doSimulado;
  return [...filtradas].sort((a, b) => {
    if (ordem === 'prova') return (a.numero ?? Number.MAX_SAFE_INTEGER) - (b.numero ?? Number.MAX_SAFE_INTEGER);
    if (a.acertoPct === null) return b.acertoPct === null ? 0 : 1;
    if (b.acertoPct === null) return -1;
    return ordem === 'erradas' ? a.acertoPct - b.acertoPct : b.acertoPct - a.acertoPct;
  });
}

const letra = (l: string) => l.trim().toUpperCase() as Alternativa['letra'];

export function alternativasDeQuestao(q: QuestaoMentor): Alternativa[] {
  return q.alternativas.map((a) => ({
    letra: letra(a.label),
    texto: semPrefixoAlternativa(textoSeguro(a.texto), a.label),
    correta: a.correta,
    marcadaPct: a.pct,
  }));
}

export function alternativasDeResumo(q: QuestaoResumoMentor): Alternativa[] {
  const entradas = Object.entries(q.distribuicao).filter(([l]) => l.toLowerCase() !== 'branco').sort(([a], [b]) => a.localeCompare(b));
  // Base = quem marcou alguma alternativa (em branco fica fora, como no protótipo).
  const total = entradas.reduce((s, [, n]) => s + n, 0);
  return entradas.map(([l, n]) => ({
    letra: letra(l),
    texto: '',
    correta: q.corretaLabel !== null && letra(q.corretaLabel) === letra(l),
    marcadaPct: total > 0 ? Math.round((100 * n) / total) : null,
  }));
}
