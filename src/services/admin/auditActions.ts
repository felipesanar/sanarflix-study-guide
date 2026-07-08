/**
 * Mapa action → frase humanizada em PT para a trilha de auditoria (`admin_audit_log`).
 * Usado no Command Center ("Auditoria recente") e em `/admin/auditoria`.
 *
 * Ações `view_*` são ruído de navegação e não geram frase (retornam null — filtradas na UI).
 * Ações desconhecidas também retornam null: nunca inventamos uma copy para uma action nova
 * sem mapeamento explícito.
 */

export type AuditMetadata = Record<string, unknown>;

type AuditDescriber = (metadata: AuditMetadata) => string;

const NOISE_PREFIX = 'view_';

function pickNumber(metadata: AuditMetadata, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function pickValue(metadata: AuditMetadata, ...keys: string[]): unknown {
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null) return metadata[key];
  }
  return undefined;
}

const ACTION_DESCRIBERS: Record<string, AuditDescriber> = {
  bulk_update_email: (m) => {
    const n = pickNumber(m, 'total', 'count', 'quantidade');
    return n != null ? `trocou e-mail de login de ${n} aluno${n === 1 ? '' : 's'}` : 'trocou e-mail de login em massa';
  },
  anular_questao: (m) => {
    const numero = pickValue(m, 'numero_questao', 'numero', 'questao_numero');
    return numero != null ? `anulou a Questão ${numero}` : 'anulou uma questão';
  },
  liberar_tentativa: () => 'liberou tentativa',
  ies_features_update: () => 'alterou features da IES',
  delete_user: () => 'excluiu usuário',
  user_create: () => 'criou usuário',
  sync_user_auth: () => 'sincronizou autenticação do usuário',
  generate_link_welcome: () => 'gerou link de boas-vindas',
  generate_link_reset: () => 'gerou link de redefinição de senha',
  aviso_toggle: (m) => (m.ativo === false ? 'desativou um aviso' : 'ativou um aviso'),
  aviso_delete: () => 'excluiu um aviso',
  material_delete: () => 'excluiu um material',
  feedback_update: () => 'respondeu/atualizou um feedback',
  roles_update: () => 'alterou papéis de um usuário',
  encerrar_simulado: (m) => {
    const nome = pickValue(m, 'simulado_nome', 'nome');
    return nome != null ? `encerrou o simulado "${nome}"` : 'encerrou um simulado';
  },
  import_simulado_responses: (m) => {
    const n = pickNumber(m, 'total', 'count', 'quantidade', 'imported_count');
    return n != null ? `importou ${n} resposta${n === 1 ? '' : 's'} de simulado` : 'importou respostas de simulado';
  },
  impersonate_start: () => 'iniciou impersonation de um usuário',
  impersonate_stop: () => 'encerrou impersonation de um usuário',
  user_update: () => 'atualizou dados de um usuário',
  criar_simulado: (m) => {
    const nome = pickValue(m, 'simulado_nome', 'nome');
    return nome != null ? `criou o simulado "${nome}"` : 'criou um simulado';
  },
  editar_simulado: (m) => {
    const nome = pickValue(m, 'simulado_nome', 'nome');
    return nome != null ? `editou o simulado "${nome}"` : 'editou um simulado';
  },
  aviso_save: () => 'salvou um aviso',
  material_create: () => 'criou um material',
  material_update: () => 'atualizou um material',
  study_guide_import: (m) => {
    const n = pickNumber(m, 'total', 'count', 'quantidade');
    return n != null ? `importou ${n} item${n === 1 ? '' : 's'} de guia de estudo` : 'importou um guia de estudo';
  },
};

/** Rótulos para o filtro de ação da tela de Auditoria (select). */
export const AUDIT_ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'bulk_update_email', label: 'Troca de e-mail em massa' },
  { value: 'anular_questao', label: 'Anulação de questão' },
  { value: 'liberar_tentativa', label: 'Liberação de tentativa' },
  { value: 'ies_features_update', label: 'Alteração de features da IES' },
  { value: 'delete_user', label: 'Exclusão de usuário' },
  { value: 'user_create', label: 'Criação de usuário' },
  { value: 'sync_user_auth', label: 'Sincronização de autenticação' },
  { value: 'generate_link_welcome', label: 'Geração de link de boas-vindas' },
  { value: 'generate_link_reset', label: 'Geração de link de redefinição' },
  { value: 'aviso_toggle', label: 'Ativação/desativação de aviso' },
  { value: 'aviso_delete', label: 'Exclusão de aviso' },
  { value: 'material_delete', label: 'Exclusão de material' },
  { value: 'feedback_update', label: 'Atualização de feedback' },
  { value: 'roles_update', label: 'Alteração de papéis' },
  { value: 'encerrar_simulado', label: 'Encerramento de simulado' },
  { value: 'import_simulado_responses', label: 'Importação de respostas de simulado' },
  { value: 'impersonate_start', label: 'Início de impersonation' },
  { value: 'impersonate_stop', label: 'Fim de impersonation' },
  { value: 'user_update', label: 'Atualização de usuário' },
  { value: 'criar_simulado', label: 'Criação de simulado' },
  { value: 'editar_simulado', label: 'Edição de simulado' },
  { value: 'aviso_save', label: 'Salvamento de aviso' },
  { value: 'material_create', label: 'Criação de material' },
  { value: 'material_update', label: 'Atualização de material' },
  { value: 'study_guide_import', label: 'Importação de guia de estudo' },
];

/**
 * Descreve uma entrada de auditoria em PT a partir da action + metadata.
 * Retorna `null` para ruído (`view_*`) ou ações sem mapeamento — nesse caso a UI deve
 * agrupar/ignorar a entrada em vez de mostrar a action crua.
 */
export function describeAuditEntry(action: string, metadata?: AuditMetadata | null): string | null {
  if (!action || action.startsWith(NOISE_PREFIX)) return null;
  const describe = ACTION_DESCRIBERS[action];
  if (!describe) return null;
  return describe(metadata ?? {});
}
