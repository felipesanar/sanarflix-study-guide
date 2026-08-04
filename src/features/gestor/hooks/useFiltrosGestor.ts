import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FiltroSemestre } from '@/features/gestor/api/types';

/** "6º ano" é o recorte padrão do portal (spec §4.5). */
export const SEMESTRE_PADRAO: FiltroSemestre = '6ano';

export const SEMESTRES_VALIDOS: readonly FiltroSemestre[] = [
  '6ano', 'geral',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
];

const ehSemestreValido = (valor: string | null): valor is FiltroSemestre =>
  valor !== null && (SEMESTRES_VALIDOS as readonly string[]).includes(valor);

/** Chaves do recorte global na query string. */
const CHAVE = { semestre: 'semestre', simulados: 'simulados', ies: 'ies' } as const;

export interface FiltrosGestorControl {
  semestre: FiltroSemestre;
  setSemestre(s: FiltroSemestre): void;
  simulados: string[];
  setSimulados(ids: string[]): void;
  iesId: string | null;
  setIesId(id: string): void;
}

/**
 * Recorte global do portal do gestor, com estado na URL (spec §8.2).
 *
 * Link colável, voltar/avançar e refresh preservam o recorte; a troca de tela
 * também, porque a nav carrega a query string (SidebarNav). Valor inválido de
 * semestre degrada para o padrão em vez de quebrar a tela.
 */
export function useFiltrosGestor(): FiltrosGestorControl {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * O `setSearchParams` do react-router-dom resolve a forma funcional
   * `(prev) => next` contra o `searchParams` capturado no useMemo do ÚLTIMO
   * render — não contra a escrita anterior. Duas chamadas de `escrever` no
   * mesmo tick (antes de qualquer re-render) recebem o mesmo `prev` e a
   * segunda `navigate()` sobrescreve a primeira (card 121, ponto latente).
   * Este ref é a nossa própria cadeia de "anterior", atualizada de forma
   * síncrona a cada escrita, para não depender do encadeamento interno deles.
   */
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;

  const bruto = searchParams.get(CHAVE.semestre);
  const semestre: FiltroSemestre = ehSemestreValido(bruto) ? bruto : SEMESTRE_PADRAO;

  const simulados = (searchParams.get(CHAVE.simulados) ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const iesId = searchParams.get(CHAVE.ies);

  /**
   * Toda escrita de filtro usa `replace`: filtro não é uma "página" nova, e
   * sem isso 3 cliques no mesmo segmento empilham 3 entradas de histórico
   * (card 121). O "próximo" parte do `paramsRef`, não do `searchParams` do
   * closure — ver comentário acima.
   */
  const escrever = useCallback(
    (mudanca: (params: URLSearchParams) => void) => {
      const proximos = new URLSearchParams(paramsRef.current);
      mudanca(proximos);
      paramsRef.current = proximos;
      setSearchParams(proximos, { replace: true });
    },
    [setSearchParams],
  );

  const setSemestre = useCallback(
    (valor: FiltroSemestre) => escrever((params) => params.set(CHAVE.semestre, valor)),
    [escrever],
  );

  const setSimulados = useCallback(
    (ids: string[]) =>
      escrever((params) => {
        if (ids.length === 0) params.delete(CHAVE.simulados);
        else params.set(CHAVE.simulados, ids.join(','));
      }),
    [escrever],
  );

  const setIesId = useCallback(
    (id: string) => escrever((params) => params.set(CHAVE.ies, id)),
    [escrever],
  );

  return { semestre, setSemestre, simulados, setSimulados, iesId, setIesId };
}
