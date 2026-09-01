/**
 * Papéis atribuíveis pelo Admin ao cadastrar usuários (individual ou em lote).
 *
 * Fonte única para o `Select` do diálogo individual e para a validação da
 * coluna `papel` da planilha de cadastro em lote — sem isso, as duas telas
 * divergem e o operador consegue escrever um papel que a edge function
 * `b2b-create-user` rejeita depois (ou pior, ignora).
 */

export type AppUserRole = 'aluno' | 'admin' | 'professor' | 'gestor' | 'gestor_grupo' | 'atendimento';

export const ROLE_OPTIONS: { value: AppUserRole; label: string }[] = [
  { value: 'aluno', label: 'Aluno (padrão)' },
  { value: 'admin', label: 'Admin' },
  { value: 'professor', label: 'Professor' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'gestor_grupo', label: 'Gestor de Grupo' },
  { value: 'atendimento', label: 'Atendimento' },
];

/** Valores aceitos na planilha, exatamente como aparecem no Academy. */
export const ROLE_VALUES: readonly AppUserRole[] = ROLE_OPTIONS.map((r) => r.value);

/** Lista legível para mensagens de erro da importação. */
export const ROLE_VALUES_HINT = ROLE_VALUES.join(', ');

/** minúsculas, sem acento, espaços/hífens -> `_`. */
function chave(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
}

const MAPA: Record<string, AppUserRole> = (() => {
  const m: Record<string, AppUserRole> = {};
  for (const { value, label } of ROLE_OPTIONS) {
    m[chave(value)] = value;
    m[chave(label)] = value;
  }
  // Rótulo do aluno sem o sufixo "(padrão)".
  m[chave('aluno')] = 'aluno';
  return m;
})();

/**
 * Normaliza o papel vindo de uma planilha.
 * - vazio/ausente => `aluno` (default)
 * - valor desconhecido => `null` (o chamador transforma em erro de linha; nunca
 *   se cria um papel novo por importação)
 */
export function normalizeRoleInput(bruto: string | null | undefined): AppUserRole | null {
  const texto = (bruto ?? '').trim();
  if (!texto) return 'aluno';
  return MAPA[chave(texto)] ?? null;
}

export function roleLabel(role: AppUserRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}
