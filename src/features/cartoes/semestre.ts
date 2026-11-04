/**
 * Filtro por semestre da tela de emissão: uma IES costuma aplicar o simulado só em alguns semestres.
 * `users.semestre` é um inteiro opcional; quem não tem semestre cadastrado fica na opção "Sem semestre".
 * Nenhuma seleção marcada = todos os semestres.
 */
export const SEM_SEMESTRE = 'sem';

export interface ComSemestre {
  semestre?: number | null;
}

export interface OpcaoSemestre {
  /** Número do semestre em texto, ou `SEM_SEMESTRE`. */
  chave: string;
  rotulo: string;
  qtd: number;
}

export function chaveSemestre(aluno: ComSemestre): string {
  return aluno.semestre == null ? SEM_SEMESTRE : String(aluno.semestre);
}

export function rotuloSemestre(chave: string): string {
  return chave === SEM_SEMESTRE ? 'Sem semestre' : `${chave}º`;
}

/** Semestres que existem na lista, em ordem numérica, com "Sem semestre" por último. */
export function semestresDisponiveis(alunos: ComSemestre[]): OpcaoSemestre[] {
  const contagem = new Map<string, number>();
  for (const a of alunos) {
    const k = chaveSemestre(a);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .sort(([a], [b]) => (a === SEM_SEMESTRE ? 1 : b === SEM_SEMESTRE ? -1 : Number(a) - Number(b)))
    .map(([chave, qtd]) => ({ chave, rotulo: rotuloSemestre(chave), qtd }));
}

/** Mantém só os alunos dos semestres escolhidos; sem nenhum escolhido, devolve todos. */
export function filtrarPorSemestre<T extends ComSemestre>(alunos: T[], escolhidos: ReadonlySet<string>): T[] {
  if (!escolhidos.size) return alunos;
  return alunos.filter((a) => escolhidos.has(chaveSemestre(a)));
}

/** Trecho do nome do arquivo: `sem-6-7` (vazio quando não há filtro). */
export function sufixoDeSemestres(escolhidos: ReadonlySet<string>): string {
  if (!escolhidos.size) return '';
  const ordenados = [...escolhidos].sort((a, b) =>
    a === SEM_SEMESTRE ? 1 : b === SEM_SEMESTRE ? -1 : Number(a) - Number(b),
  );
  return `sem-${ordenados.map((c) => (c === SEM_SEMESTRE ? 'sem-info' : c)).join('-')}`;
}
