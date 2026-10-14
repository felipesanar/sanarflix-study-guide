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

export interface PacoteSimulado {
  id: string;
  sequence_number: number;
  title: string;
  questions_count: number | null;
  execution_window_start: string | null;
  execution_window_end: string | null;
  status: string | null;
}
export interface PacoteQuestao {
  id: string;
  simulado_id: string;
  question_number: number;
  area: string | null;
  theme: string | null;
  correta_label: string | null;
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
    sincronizado_em: sincronizadoEm,
  }));

  const questoes = pacote.questoes.map((q) => ({
    id: q.id,
    simulado_id: q.simulado_id,
    numero: q.question_number,
    grande_area: q.area,
    tema: q.theme,
    correta_label: q.correta_label,
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

  return { simulados, questoes, alunos, tentativas, respostas };
}
