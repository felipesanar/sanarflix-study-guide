/**
 * Semestres 9º-12º não costumam ter guia numérico próprio: o conteúdo desses
 * alunos vive sob o rótulo "INTERNATO". Mantemos a mesma lista usada em
 * StudyGuide para o fallback automático.
 */
const INTERNATO_FALLBACK_SEMESTERS = [9, 10, 11, 12];

/**
 * Resolve qual semestre deve ficar selecionado por padrão no guia de estudos.
 *
 * Ordem de preferência:
 *  1. O semestre do próprio aluno, quando existe guia para ele.
 *  2. INTERNATO, para alunos de 9º-12º cujo semestre numérico não tem guia.
 *  3. O primeiro semestre disponível na lista.
 *
 * Retorna '' quando não há nenhum semestre disponível (lista vazia).
 *
 * A lista `semestres` deve vir já normalizada (ex.: "1", "2", "INTERNATO"),
 * no mesmo formato usado pelo dropdown do guia.
 */
export function resolveDefaultSemestre(
  semestres: string[],
  userSemestre?: number | string | null,
): string {
  if (!semestres || semestres.length === 0) return '';

  const userSemStr = userSemestre != null ? userSemestre.toString() : '';
  if (userSemStr && semestres.includes(userSemStr)) return userSemStr;

  const userSemNum = userSemestre != null ? Number(userSemestre) : NaN;
  const internato = semestres.find((s) => s.toUpperCase() === 'INTERNATO');
  if (INTERNATO_FALLBACK_SEMESTERS.includes(userSemNum) && internato) {
    return internato;
  }

  return semestres[0];
}
