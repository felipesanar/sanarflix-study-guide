/**
 * Escolha da fonte de dados do Mentor pela env (mock > flix > academy).
 *
 * - `VITE_MENTOR_FONTE=mock` → fonteMock (dados dos protótipos; `VITE_MENTOR_MODALIDADE=b2c|b2b`, padrão b2c).
 *   Bloqueado em produção (`APP_ENV=production`): cai para a próxima fonte, nunca mostra dado fictício a mentor real.
 * - `VITE_FLIX_MENTORIA=on` (ou `VITE_MENTOR_FONTE=flix`) → fonteFlix; DAG e kanban seguem no Academy.
 * - Sem nada → fonteAcademy (padrão).
 *
 * `fonteAtiva()` é a parte Flix do contrato (FonteMentoria); `dadosAtivos()` é a parte Academy
 * (DAGs + kanban), que só troca no mock.
 */
import { env } from '@/config/env';
import type { FonteMentoria } from './fonte';
import { criarDadosAcademy, criarFonteAcademy, type DadosAcademy, type FonteAcademy } from './fonteAcademy';
import { criarFonteFlix } from './fonteFlix';
import { criarMock, type Mock, type ModalidadeMock } from './fonteMock';

export type NomeFonte = 'academy' | 'flix' | 'mock';

export interface ConfigFonte {
  /** VITE_MENTOR_FONTE */
  fonte?: string | null;
  /** VITE_FLIX_MENTORIA (já convertido para booleano) */
  flix?: boolean | null;
  /** VITE_MENTOR_MODALIDADE (só mock) */
  modalidade?: string | null;
  /** APP_ENV === 'production' */
  producao?: boolean;
  /** Só testes: latência do mock. */
  latenciaMs?: number;
}

let configTeste: ConfigFonte | null = null;
/** Só testes: força a configuração lida por `fonteAtiva()`/`dadosAtivos()` sem argumento. */
export function _definirConfigParaTestes(cfg: ConfigFonte | null): void {
  configTeste = cfg;
  _resetarFontes();
}

export function lerConfigFonte(): ConfigFonte {
  if (configTeste) return configTeste;
  return {
    fonte: env.MENTOR_FONTE ?? null,
    flix: env.FLIX_MENTORIA,
    modalidade: (import.meta.env.VITE_MENTOR_MODALIDADE as string | undefined) ?? null,
    producao: env.APP_ENV === 'production',
  };
}

export function escolherFonte(cfg: ConfigFonte): NomeFonte {
  const pedida = (cfg.fonte ?? '').trim().toLowerCase();
  if (pedida === 'mock' && !cfg.producao) return 'mock';
  if (pedida === 'flix' || cfg.flix === true) return 'flix';
  return 'academy';
}

export function modalidadeMock(cfg: ConfigFonte): ModalidadeMock {
  return (cfg.modalidade ?? '').trim().toLowerCase() === 'b2b' ? 'b2b' : 'b2c';
}

// ─── Instâncias (uma por processo; o cache de `me` vive na fonteAcademy) ─────

let academy: FonteAcademy | null = null;
let dadosAcademy: DadosAcademy | null = null;
let flix: FonteMentoria | null = null;
const mocks = new Map<string, Mock>();

function instanciaAcademy(): FonteAcademy {
  return (academy ??= criarFonteAcademy());
}
function instanciaMock(cfg: ConfigFonte): Mock {
  const modalidade = modalidadeMock(cfg);
  const chave = `${modalidade}:${cfg.latenciaMs ?? 'padrao'}`;
  let m = mocks.get(chave);
  if (!m) {
    m = criarMock(modalidade, cfg.latenciaMs === undefined ? {} : { latenciaMs: cfg.latenciaMs });
    mocks.set(chave, m);
  }
  return m;
}

export function fonteAtiva(cfg: ConfigFonte = lerConfigFonte()): FonteMentoria {
  switch (escolherFonte(cfg)) {
    case 'mock': return instanciaMock(cfg).fonte;
    case 'flix': return (flix ??= criarFonteFlix());
    default: return instanciaAcademy();
  }
}

export function dadosAtivos(cfg: ConfigFonte = lerConfigFonte()): DadosAcademy {
  if (escolherFonte(cfg) === 'mock') return instanciaMock(cfg).dados;
  // A modalidade vem do contexto do mentor (semestre só no B2B), cacheado pela fonteAcademy.
  return (dadosAcademy ??= criarDadosAcademy(undefined, () => instanciaAcademy().modalidade()));
}

/** Só testes: descarta as instâncias (e o estado do mock). */
export function _resetarFontes(): void {
  academy = null;
  dadosAcademy = null;
  flix = null;
  mocks.clear();
}
