/** Textos literais do protótipo (`Mentor B2C.dc.html` § MURAL) e rótulos do Mural B2C. */
import type { Publicacao, TagMural } from '@/features/mentor/api/types';

// TODO(P2): validar inclusão de "Novidade"; hipótese atual = três tags (docs/05).
export const TAGS_MURAL: readonly { tag: TagMural; rotulo: string }[] = [
  { tag: 'desempenho', rotulo: 'Desempenho' },
  { tag: 'aviso', rotulo: 'Aviso' },
  { tag: 'fique_por_dentro', rotulo: 'Fique por dentro' },
];
export const ROTULO_TAG_MURAL: Record<TagMural, string> = {
  desempenho: 'Desempenho',
  aviso: 'Aviso',
  fique_por_dentro: 'Fique por dentro',
};
export const TAG_PADRAO: TagMural = 'desempenho';

export const TEXTOS_MURAL = {
  erroTitulo: 'Informe o título.',
  erroMensagem: 'Escreva a mensagem.',
  erroSelecao: 'Selecione pelo menos um aluno.',
  erroTituloLink: 'Link inserido precisa de título.',
  /** Não existe no protótipo: o servidor só aceita https (lib/linkSeguro). */
  erroLinkInvalido: 'Use um link https://.',
  erroCanal: 'Use um link de convite do WhatsApp (chat.whatsapp.com/…).',
  /** Não existem no protótipo: regras do bucket `mural-anexos`. */
  erroAnexoTipo: 'Envie imagem (PNG, JPG, WebP) ou PDF.',
  erroAnexoTamanho: 'O anexo passa de 10 MB. Escolha um arquivo menor.',
  placeholderTitulo: 'Ex.: Sua nota caiu. Vamos entender o porquê?',
  placeholderMensagem: 'Escreva como se estivesse falando com o aluno.',
  placeholderLinkTitulo: 'Ex.: Revisão de Preventiva em 20 minutos',
  previaTitulo: 'Título da publicação',
  previaMensagem: 'A mensagem aparece aqui, como o aluno vai ler na home.',
  nenhumSelecionado: 'Nenhum aluno selecionado',
  toastRascunho: 'Rascunho salvo',
  toastExcluida: 'Publicação excluída · some da home dos alunos',
  toastCanal: 'Link do grupo atualizado na página dos alunos',
  canalFixo: 'Link geral, definido pela SanarFlix',
} as const;

export function rotuloAlunos(n: number): string {
  return `${n} ${n === 1 ? 'aluno' : 'alunos'}`;
}

/** "Toda a turma" · "Caio Menezes · individual" · "6 alunos · individual". */
export function rotuloDestinatario(pub: Pick<Publicacao, 'destino'>, nomeDe: (alunoId: string) => string | null): string {
  if (pub.destino.tipo === 'turma') return 'Toda a turma';
  const ids = pub.destino.alunoIds;
  const nome = ids.length === 1 ? nomeDe(ids[0]) : null;
  return `${nome ?? rotuloAlunos(ids.length)} · individual`;
}

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
/** dd/mm em America/Sao_Paulo; `null` sem data válida (nunca inventa data). */
export function dataCurta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : FORMATO_DATA.format(d);
}
