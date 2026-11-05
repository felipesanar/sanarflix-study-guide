/**
 * Identidade da faixa do Início (um dos 4 lugares de identidade, docs/05 D6): tribo (B2C) ou IES (B2B).
 * Mesma resolução de tribo do `MentorShell` (titular da modalidade do mentor, senão a primeira).
 */
import type { ReactNode } from 'react';
import type { MeFlix, TriboMe } from '../../api/fonte';
import type { TriboId } from '../../api/types';
import { identidadeTribo, temaIes, temaTribo, temaUniAtenas, type TemaContexto } from '../../tema/contexto';

// Assets oficiais do handoff, empacotados (mesma origem que o shell usa no cartão da sidebar).
const ICONES_TRIBO: Record<TriboId, string> = {
  carcara: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-carcara.png', import.meta.url).href,
  camaleao: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-camaleao.png', import.meta.url).href,
  colmeia: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-colmeia.png', import.meta.url).href,
  octopus: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-octopus.png', import.meta.url).href,
};
const SELO_PARACATU = new URL('../../../../../docs/handoff/mentor/prototipos/brand/selo-paracatu.png', import.meta.url).href;
const TOCHA_UNIATENAS = new URL('../../../../../docs/handoff/mentor/prototipos/brand/uniatenas-tocha.png', import.meta.url).href;
const ICONE_UNIATENAS = new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-uniatenas.png', import.meta.url).href;

export interface ContextoInicio {
  tribo: TriboMe | undefined;
  primeiroNome: string;
  tema: TemaContexto;
  eyebrow?: string;
  marca: ReactNode;
  /** B2C: ícone da tribo (também usado no encontro em destaque). */
  iconeTribo: string | null;
}

const ehTriboId = (s: string | undefined): s is TriboId => !!s && Object.prototype.hasOwnProperty.call(ICONES_TRIBO, s);

export function contextoInicio(me: MeFlix): ContextoInicio {
  const { mentor } = me;
  const tribos = me.tribos.filter((t) => t.modalidade === mentor.modalidade);
  const tribo = tribos.find((t) => t.papel === 'titular') ?? tribos[0];
  const primeiroNome = mentor.nome.trim().split(/\s+/)[0] ?? '';

  if (mentor.modalidade === 'b2c') {
    const id = ehTriboId(tribo?.slug) ? tribo!.slug as TriboId : null;
    const cadastro = { lema: tribo?.lema ?? undefined, cores: tribo?.cores ?? undefined };
    const lema = tribo?.lema ?? (id ? identidadeTribo(id, cadastro).lema : null);
    const icone = tribo?.iconeUrl ?? (id ? ICONES_TRIBO[id] : null);
    const nome = tribo?.nome ?? '';
    return {
      tribo, primeiroNome,
      tema: id ? temaTribo(id, cadastro) : temaIes(null),
      eyebrow: nome ? `Tribo ${nome}${lema ? ` · ${lema}` : ''}` : undefined,
      marca: icone ? <img src={icone} alt={`Tribo ${nome}`} className="block h-auto w-10 flex-none" /> : null,
      iconeTribo: icone,
    };
  }

  // B2B: UniAtenas tem identidade cadastrada no handoff; outras IES caem nos tokens do Academy (docs/01).
  const ies = tribo?.iesNome ?? tribo?.nome ?? '';
  const uniatenas = /uniatenas/i.test(ies);
  const paracatu = /paracatu/i.test(tribo?.campus ?? tribo?.nome ?? '');
  const rotuloSelo = ['Selo', ies, tribo?.campus].filter(Boolean).join(' ');
  let marca: ReactNode = null;
  if (uniatenas && paracatu) {
    marca = (
      <div role="img" aria-label={rotuloSelo} className="relative h-12 w-12 flex-none">
        <img src={SELO_PARACATU} alt="" className="block h-12 w-12" />
        <img src={TOCHA_UNIATENAS} alt="" className="absolute left-1/2 top-1/2 h-[18px] w-auto -translate-x-1/2 -translate-y-1/2" />
      </div>
    );
  } else if (tribo?.iconeUrl || uniatenas) {
    marca = <img src={tribo?.iconeUrl ?? ICONE_UNIATENAS} alt={rotuloSelo} className="block h-12 w-12 flex-none" />;
  }
  return { tribo, primeiroNome, tema: uniatenas ? temaUniAtenas : temaIes(null), marca, iconeTribo: null };
}
