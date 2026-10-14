import type { PostMural } from '@/services/mentor/mural';

export const TAGS_SUGERIDAS = ['Desempenho', 'Aviso', 'Fique por dentro'];
export const LIMITE_ANEXO_BYTES = 10 * 1024 * 1024;
const LIMITE_NOME = 100;
export const LIMITE_ANEXO_MENSAGEM = 'O anexo passa de 10 MB. Escolha um arquivo menor.';

/** Nome de arquivo seguro para o path do Storage (sem acento, espaço ou barra). */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!limpo) return 'arquivo';
  if (limpo.length <= LIMITE_NOME) return limpo;
  // Corta o corpo e preserva a extensão.
  const ponto = limpo.lastIndexOf('.');
  const ext = ponto > 0 && limpo.length - ponto <= 10 ? limpo.slice(ponto) : '';
  return limpo.slice(0, LIMITE_NOME - ext.length) + ext;
}

export interface FormularioMural {
  tag: string;
  titulo: string;
  mensagem: string;
  linkTitulo: string;
  linkUrl: string;
  publico: 'turma' | 'selecionados';
  destinatarios: string[];
}

export function formularioVazio(): FormularioMural {
  return { tag: '', titulo: '', mensagem: '', linkTitulo: '', linkUrl: '', publico: 'turma', destinatarios: [] };
}

export function formularioDoPost(post: PostMural): FormularioMural {
  return {
    tag: post.tag,
    titulo: post.titulo,
    mensagem: post.mensagem,
    linkTitulo: post.link_titulo ?? '',
    linkUrl: post.link_url ?? '',
    publico: post.publico,
    destinatarios: post.destinatarios ?? [],
  };
}

/** Mensagens de validação; vazio = pode salvar/publicar. */
export function validarFormulario(f: FormularioMural): string[] {
  const erros: string[] = [];
  if (!f.tag.trim()) erros.push('Escolha ou escreva uma tag.');
  if (!f.titulo.trim()) erros.push('Informe o título.');
  if (!f.mensagem.trim()) erros.push('Escreva a mensagem.');
  if (f.linkUrl.trim() && !/^https:\/\/\S+$/i.test(f.linkUrl.trim())) erros.push('Use um link https://');
  if (f.linkUrl.trim() && !f.linkTitulo.trim()) erros.push('Dê um título ao link.');
  if (f.publico === 'selecionados' && f.destinatarios.length === 0) {
    erros.push('Selecione ao menos um aluno.');
  }
  return erros;
}

export function pluralAlunos(n: number): string {
  return `${n} ${n === 1 ? 'aluno' : 'alunos'}`;
}
