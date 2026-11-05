/** Estado do composer do Mural e validações literais do protótipo (docs/02 § Tela 4). */
import type { NovaPublicacao } from '@/features/mentor/api/fonte';
import type { TagMural } from '@/features/mentor/api/types';
import { ehLinkHttps } from '@/features/mentor/lib/linkSeguro';
import { TAG_PADRAO, TEXTOS_MURAL } from './rotulosMural';

/** Item de destinatário em "Selecionados": um grupo por alerta ou um aluno. */
export interface ItemSelecao {
  chave: string;
  rotulo: string;
  alunoIds: string[];
  tipo: 'grupo' | 'aluno';
}

/** Anexo do composer: arquivo novo (envia ao publicar) ou o já gravado na publicação. */
export type AnexoForm =
  | { tipo: 'novo'; arquivo: File; nome: string }
  | { tipo: 'existente'; url: string; nome: string };

export interface FormMural {
  tag: TagMural;
  para: 'turma' | 'selecionados';
  selecao: ItemSelecao[];
  titulo: string;
  mensagem: string;
  linkAberto: boolean;
  linkUrl: string;
  linkTitulo: string;
  anexo: AnexoForm | null;
  registrar: boolean;
}

export type CampoMural = 'titulo' | 'mensagem' | 'selecao' | 'linkUrl' | 'linkTitulo' | 'anexo';
export type ErrosMural = Partial<Record<CampoMural, string>>;

export function formVazio(): FormMural {
  return {
    tag: TAG_PADRAO, para: 'turma', selecao: [], titulo: '', mensagem: '',
    linkAberto: false, linkUrl: '', linkTitulo: '', anexo: null, registrar: true,
  };
}

/** Ordem de foco do primeiro erro. */
export const ORDEM_CAMPOS: readonly CampoMural[] = ['selecao', 'titulo', 'mensagem', 'linkUrl', 'linkTitulo', 'anexo'];

export function validarPublicacao(f: FormMural, { exigirDestinatarios }: { exigirDestinatarios: boolean }): ErrosMural {
  const e: ErrosMural = {};
  if (exigirDestinatarios && f.para === 'selecionados' && alunosSelecionados(f.selecao).length === 0) e.selecao = TEXTOS_MURAL.erroSelecao;
  if (!f.titulo.trim()) e.titulo = TEXTOS_MURAL.erroTitulo;
  if (!f.mensagem.trim()) e.mensagem = TEXTOS_MURAL.erroMensagem;
  const url = f.linkUrl.trim();
  if (url && !ehLinkHttps(url)) e.linkUrl = TEXTOS_MURAL.erroLinkInvalido;
  else if (url && !f.linkTitulo.trim()) e.linkTitulo = TEXTOS_MURAL.erroTituloLink;
  return e;
}

export function linkDaPublicacao(f: Pick<FormMural, 'linkUrl' | 'linkTitulo'>): { url: string; titulo: string } | null {
  const url = f.linkUrl.trim();
  return url ? { url, titulo: f.linkTitulo.trim() } : null;
}

/** União dos alunos dos chips, na ordem da primeira ocorrência. */
export function alunosSelecionados(selecao: readonly ItemSelecao[]): string[] {
  return [...new Set(selecao.flatMap((s) => s.alunoIds))];
}

export function destinoDaPublicacao(f: Pick<FormMural, 'para' | 'selecao'>): NovaPublicacao['destino'] {
  return f.para === 'turma' ? { tipo: 'tribo' } : { tipo: 'alunos', alunoIds: alunosSelecionados(f.selecao) };
}

/**
 * Link do grupo da tribo: só convite `https://chat.whatsapp.com/<código>` (mesma regra da RPC
 * `mentor_canal_grupo_salvar`). Sem protocolo, completa com https; `http:` e outros hosts são recusados.
 */
export function normalizarGrupoWhatsapp(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  const completo = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  return /^https:\/\/chat\.whatsapp\.com\/[^\s/]\S*$/.test(completo) && ehLinkHttps(completo) ? completo : null;
}
