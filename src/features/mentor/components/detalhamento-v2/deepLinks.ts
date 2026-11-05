/**
 * Deep links que saem do Detalhamento (docs/06 § Estado de UI: "questão → Mural com destinatários",
 * "Diagnóstico → Mural com texto").
 *
 * Contrato dos parâmetros (o Mural do B2C e o mural de Canais do B2B leem os mesmos nomes):
 *  - `para`: e-mails separados por vírgula (`parseEmailsParam`); ausente = turma toda;
 *  - `tag`: `desempenho` | `aviso` | `fique_por_dentro`;
 *  - `titulo`: texto simples (`tituloDeParam`, até 120 caracteres);
 *  - `mensagem`: texto simples, até `MENSAGEM_MAX` caracteres;
 *  - B2B: `/mentor/canais?mural=1&…` abre o formulário do mural em Canais.
 */
import type { TagMural } from '@/features/mentor/api/types';
import { parseEmailsParam } from '@/features/mentor/lib/emailsParam';
import { TITULO_MAX, tituloDeParam } from '@/features/mentor/lib/textoSeguro';

export const MENSAGEM_MAX = 1500;

export interface PreenchimentoMural {
  /** E-mails dos destinatários; vazio/ausente = turma toda. */
  para?: string[];
  tag: TagMural;
  titulo: string;
  mensagem?: string;
}

export function urlMuralPreenchido(modalidade: 'b2c' | 'b2b', p: PreenchimentoMural): string {
  const q = new URLSearchParams();
  if (modalidade === 'b2b') q.set('mural', '1');
  const para = parseEmailsParam((p.para ?? []).join(','));
  if (para.length) q.set('para', para.join(','));
  q.set('tag', p.tag);
  const titulo = tituloDeParam(p.titulo);
  if (titulo) q.set('titulo', titulo.slice(0, TITULO_MAX));
  const mensagem = (p.mensagem ?? '').trim().slice(0, MENSAGEM_MAX);
  if (mensagem) q.set('mensagem', mensagem);
  return `${modalidade === 'b2b' ? '/mentor/canais' : '/mentor/mural'}?${q.toString()}`;
}
