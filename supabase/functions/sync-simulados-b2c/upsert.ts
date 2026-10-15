// sync-simulados-b2c — lógica pura (sem APIs do Deno), testável sob Vitest.
// Converte o pacote do mentoria-export nas linhas das tabelas b2c_*.

export function lotes<T>(itens: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  if (tamanho < 1) return out;
  for (let i = 0; i < itens.length; i += tamanho) {
    out.push(itens.slice(i, i + tamanho));
  }
  return out;
}

export function corteMaisDificil(
  alvos: { corte_geral: number | null }[],
): number | null {
  let max: number | null = null;
  for (const a of alvos) {
    const c = a.corte_geral;
    if (c === null || c === undefined || !Number.isFinite(c)) continue;
    if (max === null || c > max) max = c;
  }
  return max;
}

// Separa os e-mails em "novos" (ainda fora do espelho: precisam do histórico
// completo, desde = null) e "existentes" (sincronização incremental).
export function separarPorEspelho(
  emails: string[],
  emailsNoEspelho: Iterable<string>,
): { novos: string[]; existentes: string[] } {
  const espelho = new Set<string>();
  for (const e of emailsNoEspelho) espelho.add(e.trim().toLowerCase());
  const novos: string[] = [];
  const existentes: string[] = [];
  for (const e of emails) {
    (espelho.has(e.trim().toLowerCase()) ? existentes : novos).push(e);
  }
  return { novos, existentes };
}

// Remove e-mails de mensagens de erro antes de gravar/logar (dado pessoal).
export function sanitizarErro(mensagem: string): string {
  return mensagem.replace(/[^\s@]+@[^\s@]+/g, "<email>");
}

// Mantém a última ocorrência de cada chave (a primeira posição é preservada).
function deduplicar<T>(linhas: T[], chave: (l: T) => string): T[] {
  const mapa = new Map<string, T>();
  for (const l of linhas) mapa.set(chave(l), l);
  return [...mapa.values()];
}

export interface PacoteSimulado {
  id: string;
  sequence_number: number;
  title: string;
  questions_count: number | null;
  execution_window_start: string | null;
  execution_window_end: string | null;
  status: string | null;
  // Novos no export; ausentes em payloads antigos (tratados como null).
  results_release_at?: string | null;
}
export interface PacoteQuestao {
  id: string;
  simulado_id: string;
  question_number: number;
  area: string | null;
  theme: string | null;
  correta_label: string | null;
  // Novos no export; ausentes em payloads antigos (tratados como null).
  text?: string | null;
  explanation?: string | null;
  image_url?: string | null;
  image_url_2?: string | null;
  explanation_image_url?: string | null;
  difficulty?: string | null;
}
export interface PacoteOpcao {
  id: string;
  question_id: string;
  label: string;
  text: string | null;
  is_correct: boolean | null;
}
export interface PacoteAlvo {
  institution_id: string;
  nome: string | null;
  corte_geral: number | null;
  corte_cota: number | null;
}
export interface PacoteTentativa {
  id: string;
  simulado_id: string;
  finished_at: string;
  score_percentage: number | null;
  total_correct: number | null;
  total_answered: number | null;
  attempt_type: string | null;
  // Novos no export; ausentes em payloads antigos (tratados como null).
  is_within_window?: boolean | null;
  posicao?: number | null;
  participantes?: number | null;
  percentil?: number | null;
}
export interface PacoteResposta {
  attempt_id: string;
  question_id: string;
  selected_label: string | null;
  is_correct: boolean | null;
  was_answered: boolean | null;
}
export interface PacoteAluno {
  email: string;
  nome: string | null;
  segment: string | null;
  especialidade: { id: string; nome: string } | null;
  alvos: PacoteAlvo[];
  tentativas: PacoteTentativa[];
  respostas: PacoteResposta[];
}
export interface Pacote {
  gerado_em: string;
  simulados: PacoteSimulado[];
  questoes: PacoteQuestao[];
  // Novo no export; ausente em payloads antigos (tratado como []).
  opcoes?: PacoteOpcao[];
  alunos: PacoteAluno[];
}

export function mapearPacote(pacote: Pacote) {
  const sincronizadoEm = pacote.gerado_em;

  const simulados = pacote.simulados.map((s) => ({
    id: s.id,
    sequence_number: s.sequence_number,
    titulo: s.title,
    questoes: s.questions_count,
    janela_inicio: s.execution_window_start,
    janela_fim: s.execution_window_end,
    status: s.status,
    resultado_liberado_em: s.results_release_at ?? null,
    sincronizado_em: sincronizadoEm,
  }));

  const questoes = pacote.questoes.map((q) => ({
    id: q.id,
    simulado_id: q.simulado_id,
    numero: q.question_number,
    grande_area: q.area,
    tema: q.theme,
    correta_label: q.correta_label,
    enunciado: q.text ?? null,
    explicacao: q.explanation ?? null,
    imagem_url: q.image_url ?? null,
    imagem_url_2: q.image_url_2 ?? null,
    explicacao_imagem_url: q.explanation_image_url ?? null,
    dificuldade: q.difficulty ?? null,
  }));

  // FK: alternativa só entra se a questão dela está neste pacote (a questão é gravada antes).
  const idsQuestoes = new Set(questoes.map((q) => q.id));
  const alternativas = (pacote.opcoes ?? [])
    .filter((o) => o.id && o.label && idsQuestoes.has(o.question_id))
    .map((o) => ({
      id: o.id,
      questao_id: o.question_id,
      label: o.label,
      texto: o.text ?? null,
      correta: o.is_correct ?? false,
    }));

  const alunos = [];
  const tentativas = [];
  const respostas = [];

  for (const a of pacote.alunos) {
    alunos.push({
      email: a.email,
      nome: a.nome,
      segment: a.segment,
      especialidade_id: a.especialidade?.id ?? null,
      especialidade_nome: a.especialidade?.nome ?? null,
      alvos: a.alvos,
      corte_mais_dificil: corteMaisDificil(a.alvos),
      sincronizado_em: sincronizadoEm,
    });

    // acerto_pct é NOT NULL: tentativa sem score não entra (nem suas respostas).
    const aceitas = new Set<string>();
    for (const t of a.tentativas) {
      if (t.score_percentage === null || t.score_percentage === undefined) continue;
      aceitas.add(t.id);
      tentativas.push({
        id: t.id,
        email: a.email,
        simulado_id: t.simulado_id,
        finalizada_em: t.finished_at,
        acerto_pct: t.score_percentage,
        acertos: t.total_correct,
        respondidas: t.total_answered,
        modalidade: t.attempt_type,
        dentro_janela: t.is_within_window ?? null,
        posicao: t.posicao ?? null,
        participantes: t.participantes ?? null,
        percentil: t.percentil ?? null,
      });
    }

    for (const r of a.respostas) {
      if (!aceitas.has(r.attempt_id)) continue;
      respostas.push({
        tentativa_id: r.attempt_id,
        questao_id: r.question_id,
        marcada_label: r.selected_label,
        correta: r.is_correct ?? false,
        respondida: r.was_answered ?? r.selected_label !== null,
      });
    }
  }

  // Duplicata na origem abortaria o upsert ("cannot affect row a second time").
  return {
    simulados: deduplicar(simulados, (x) => x.id),
    questoes: deduplicar(questoes, (x) => x.id),
    // unique (questao_id, label) também aborta o upsert: dedupe pelas duas chaves
    alternativas: deduplicar(
      deduplicar(alternativas, (x) => x.id),
      (x) => `${x.questao_id}|${x.label}`,
    ),
    alunos: deduplicar(alunos, (x) => x.email),
    tentativas: deduplicar(tentativas, (x) => x.id),
    respostas: deduplicar(respostas, (x) => `${x.tentativa_id}|${x.questao_id}`),
  };
}
