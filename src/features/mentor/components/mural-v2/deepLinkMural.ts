/**
 * Deep link do Mural (docs/06 § Estado de UI: "questão → Mural com destinatários; Diagnóstico → Mural com texto").
 *
 * Contrato (todos opcionais; a URL não é confiável):
 *  - `para`     e-mails separados por vírgula → modo "Selecionados" (já usado pelo drawer e pelas intervenções);
 *  - `grupo`    rótulo do chip que agrupa os `para` (ex.: "Marcaram C na Q12"); sem ele, um chip por aluno;
 *  - `titulo`   título preenchido;
 *  - `mensagem` mensagem preenchida (texto simples, sem marcação);
 *  - `tag`      desempenho | aviso | fique_por_dentro.
 */
import type { TagMural } from '@/features/mentor/api/types';
import { parseEmailsParam } from '@/features/mentor/lib/emailsParam';
import { textoSeguro, tituloDeParam } from '@/features/mentor/lib/textoSeguro';
import { ROTULO_TAG_MURAL } from './rotulosMural';

export interface DeepLinkMural {
  emails: string[];
  grupo: string | null;
  titulo: string | null;
  mensagem: string | null;
  tag: TagMural | null;
}

export const PARAMS_DEEP_LINK_MURAL = ['para', 'grupo', 'titulo', 'mensagem', 'tag'] as const;
export const MENSAGEM_MAX = 2000;

function mensagemDeParam(bruto: string | null): string | null {
  if (bruto == null) return null;
  // eslint-disable-next-line no-control-regex
  const t = textoSeguro(bruto.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')).slice(0, MENSAGEM_MAX).trim();
  return t || null;
}

export function lerDeepLinkMural(sp: URLSearchParams): DeepLinkMural | null {
  if (!PARAMS_DEEP_LINK_MURAL.some((p) => sp.has(p))) return null;
  const tag = sp.get('tag');
  return {
    emails: parseEmailsParam(sp.get('para')),
    grupo: tituloDeParam(sp.get('grupo')),
    titulo: tituloDeParam(sp.get('titulo')),
    mensagem: mensagemDeParam(sp.get('mensagem')),
    tag: tag && tag in ROTULO_TAG_MURAL ? (tag as TagMural) : null,
  };
}

/** Rota do Mural com o composer preenchido (para Detalhamento, drawer e intervenções). */
export function urlMuralComposer(p: Partial<DeepLinkMural>): string {
  const sp = new URLSearchParams();
  const emails = parseEmailsParam((p.emails ?? []).join(','));
  if (emails.length) sp.set('para', emails.join(','));
  if (p.grupo) sp.set('grupo', p.grupo);
  if (p.titulo) sp.set('titulo', p.titulo);
  if (p.mensagem) sp.set('mensagem', p.mensagem);
  if (p.tag) sp.set('tag', p.tag);
  const q = sp.toString();
  return q ? `/mentor/mural?${q}` : '/mentor/mural';
}
