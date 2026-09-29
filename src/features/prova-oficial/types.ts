// Tipos do aluno para a prova oficial ENAMED (spec D3/D4).
// Espelham verbatim os "Shared contracts" de
// .superpowers/sdd/2026-09-29-enamed-prova-oficial/context.md — nunca inventar
// campos aqui; qualquer mudança de forma vem do RPC (Task 1) primeiro.

// get_aluno_provas_oficiais() -> ProvaOficialResumo[]   (never null; [] when none)
export interface ProvaOficialResumo {
  simuladoId: string;
  nome: string;
  dataRealizacao: string | null; // ISO
  caderno: number | null; // 1 | 2 | null
  acertos: number;
  totalValidas: number; // questions not annulled
}

// get_aluno_prova_oficial(p_simulado_id uuid) -> ProvaOficialAluno | null
export interface ProvaOficialAluno {
  simuladoId: string;
  nome: string;
  dataRealizacao: string | null;
  caderno: number; // effective caderno (fallback 1)
  acertos: number;
  totalValidas: number;
  emBranco: number; // non-annulled questions with resposta null
  areas: { area: string; acertos: number; total: number }[]; // ordered by total desc, area asc
  trajetoria: {
    simuladoId: string;
    nome: string;
    data: string | null;
    acertoPct: number | null;
    provaOficial: boolean;
  }[]; // chronological, prova last
  questoes: QuestaoProvaOficial[]; // ordered by posicao (student's caderno)
}

export interface QuestaoProvaOficial {
  questionId: string;
  posicao: number; // number in the student's caderno
  numeroCaderno1: number;
  grandeArea: string | null;
  especialidade: string | null;
  enunciado: string;
  alternativas: { A: string | null; B: string | null; C: string | null; D: string | null };
  imagem: string | null;
  imagem2: string | null;
  imagemComentario: string | null;
  correta: string;
  resposta: string | null;
  acertou: boolean;
  anulada: boolean;
  comentario: string | null;
}
