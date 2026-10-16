/**
 * Templates do cartão (fonte da verdade: `services/cartao-omr/templates/*.json`, gerados pelo
 * `cartao-omr modelo`). O Academy os importa direto de lá: não há cópia para dessincronizar.
 */
import sfa from '../../../services/cartao-omr/templates/sfa_v2.json';
import uniatenas from '../../../services/cartao-omr/templates/uniatenas_v1.json';
import type { CardTemplate, LayoutCartao } from './types.ts';

export const TEMPLATES: Record<LayoutCartao, CardTemplate> = {
  sfa: sfa as unknown as CardTemplate,
  uniatenas: uniatenas as unknown as CardTemplate,
};

/**
 * IES do grupo UniAtenas, que usa o cartão único com matrícula em bolhas. Lista inferida pelo formato da
 * matrícula em 13/10/2026 e **ainda não confirmada** (P2 do PRD): confirme antes do primeiro uso real.
 */
export const IES_UNIATENAS = ['PARACATU', 'PASSOS', 'PORTO SEGURO', 'SETE LAGOAS', 'SORRISO', 'VALENÇA'] as const;

function chave(nome: string): string {
  return nome.normalize('NFKD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

export function ehIesUniatenas(nomeIes: string): boolean {
  return IES_UNIATENAS.some((n) => chave(n) === chave(nomeIes));
}
