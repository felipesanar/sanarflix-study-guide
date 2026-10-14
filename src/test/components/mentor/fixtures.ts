import type { AlunoTurma, Segmento } from '@/services/mentor/turma';

export function aluno(over: Partial<AlunoTurma> & { email: string }): AlunoTurma {
  return {
    nome: null,
    telefone: null,
    semestre: 5,
    acesso_ate: '2027-06-30',
    b2b: false,
    academy_user_id: null,
    sanarflix_user_id: null,
    ultima_atividade: null,
    dias_sem_atividade: null,
    segmento: 'sem_dado',
    ...over,
  };
}

export function comSegmento(email: string, nome: string, segmento: Segmento, dias: number | null): AlunoTurma {
  return aluno({ email, nome, segmento, dias_sem_atividade: dias });
}
