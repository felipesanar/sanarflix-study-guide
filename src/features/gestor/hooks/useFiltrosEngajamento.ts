import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import {
  calcularPeriodo,
  hojeSaoPaulo,
  type OpcaoPeriodo,
  type TipoConteudo,
} from '@/features/gestor/lib/engajamento';

/**
 * Estado de filtros do Engajamento, na URL (spec 2026-10-22-engajamento §9.6).
 *
 * Usa `eng_sem` e não `semestre`: `semestre` já pertence às outras telas do
 * portal (valores `6ano`/`geral`, padrão `6ano`) e as duas famílias convivem na
 * mesma query string, que a sidebar preserva na troca de tela.
 */
const CHAVE = {
  periodo: 'periodo',
  de: 'de',
  ate: 'ate',
  semestre: 'eng_sem',
  aluno: 'aluno',
  tipo: 'tipo',
} as const;

const PERIODOS_VALIDOS: readonly OpcaoPeriodo[] = ['6m', '30d', 'letivo', 'custom'];
const TIPOS_VALIDOS: readonly TipoConteudo[] = ['todos', 'video', 'document'];

const ehPeriodo = (v: string | null): v is OpcaoPeriodo =>
  v !== null && (PERIODOS_VALIDOS as readonly string[]).includes(v);
const ehTipo = (v: string | null): v is TipoConteudo =>
  v !== null && (TIPOS_VALIDOS as readonly string[]).includes(v);

/** `eng_sem` válido: inteiro de 1 a 12. Qualquer outra coisa é "todos". */
function lerSemestre(bruto: string | null): number | null {
  if (bruto === null || !/^\d{1,2}$/.test(bruto)) return null;
  const n = Number(bruto);
  return n >= 1 && n <= 12 ? n : null;
}

export interface FiltrosEngajamento {
  iesId: string | null;
  periodo: OpcaoPeriodo;
  de: string | null;
  ate: string | null;
  /** Calculados por `calcularPeriodo(hojeSaoPaulo(), …)`; sempre datas válidas para a RPC. */
  inicio: string;
  fim: string;
  /** `eng_sem`; `null` = todos (1º ao 12º). */
  semestre: number | null;
  alunoId: string | null;
  tipo: TipoConteudo;
  setPeriodo(p: OpcaoPeriodo, de?: string, ate?: string): void;
  /** Grava `eng_sem` e apaga `aluno` (regra 1). `null`/valor inválido = todos. */
  setSemestre(n: number | null): void;
  /** Grava `aluno` e apaga `eng_sem` (regra 1). `null` remove o aluno. */
  setAluno(id: string | null): void;
  setTipo(t: TipoConteudo): void;
  /** O "×" da faixa "Página filtrada por": apaga `aluno` e `eng_sem` (regra 4). */
  limparFiltroPagina(): void;
}

export type AbaEngajamento = 'visao-geral' | 'questoes' | 'conteudos';

/**
 * Query string dos links da barra de abas (regra 5): o filtro de aluno só
 * existe na Visão geral, então os links de Questões e Conteúdos o removem; o
 * link de volta para a Visão geral mantém tudo, menos `tipo` (que só existe em
 * Conteúdos). Todo o resto — período, `eng_sem`, `ies` e as chaves de outras
 * telas do portal — segue como está.
 *
 * Devolve `'?a=b'` ou `''` quando não sobra nada.
 */
export function queryParaAba(entrada: string | URLSearchParams, aba: AbaEngajamento): string {
  const params = new URLSearchParams(entrada);
  if (aba === 'visao-geral') params.delete(CHAVE.tipo);
  else params.delete(CHAVE.aluno);
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

/**
 * Filtros da aba Engajamento, com estado na URL (§9.6). A IES vem do recorte
 * global (`useFiltrosGestor().iesId`).
 *
 * Valor inválido na URL cai no padrão, sem erro (regra 6). Toda escrita usa
 * `replace: true` (regra 7), como `useFiltrosGestor`.
 */
export function useFiltrosEngajamento(): FiltrosEngajamento {
  const [searchParams, setSearchParams] = useSearchParams();
  const { iesId } = useFiltrosGestor();

  /** Mesma razão de `useFiltrosGestor`: duas escritas no mesmo tick partem da escrita anterior, não do render. */
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;

  const escrever = useCallback(
    (mudanca: (params: URLSearchParams) => void) => {
      const proximos = new URLSearchParams(paramsRef.current);
      mudanca(proximos);
      paramsRef.current = proximos;
      setSearchParams(proximos, { replace: true });
    },
    [setSearchParams],
  );

  const periodoBruto = searchParams.get(CHAVE.periodo);
  const deBruto = searchParams.get(CHAVE.de);
  const ateBruto = searchParams.get(CHAVE.ate);
  const hoje = hojeSaoPaulo();

  const { inicio, fim, periodo } = useMemo(() => {
    const pedido: OpcaoPeriodo = ehPeriodo(periodoBruto) ? periodoBruto : '6m';
    const calculado = calcularPeriodo(pedido, hoje, deBruto, ateBruto);
    return {
      inicio: calculado.inicio,
      fim: calculado.fim,
      periodo: calculado.opcaoEfetiva as OpcaoPeriodo,
    };
  }, [periodoBruto, deBruto, ateBruto, hoje]);

  const tipoBruto = searchParams.get(CHAVE.tipo);

  const setPeriodo = useCallback(
    (p: OpcaoPeriodo, de?: string, ate?: string) =>
      escrever((params) => {
        params.set(CHAVE.periodo, p);
        params.delete(CHAVE.de);
        params.delete(CHAVE.ate);
        if (p === 'custom' && de && ate) {
          params.set(CHAVE.de, de);
          params.set(CHAVE.ate, ate);
        }
      }),
    [escrever],
  );

  const setSemestre = useCallback(
    (n: number | null) =>
      escrever((params) => {
        const valido = n !== null && Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
        if (valido === null) {
          params.delete(CHAVE.semestre);
          return;
        }
        params.set(CHAVE.semestre, String(valido));
        params.delete(CHAVE.aluno);
      }),
    [escrever],
  );

  const setAluno = useCallback(
    (id: string | null) =>
      escrever((params) => {
        if (id === null || id === '') {
          params.delete(CHAVE.aluno);
          return;
        }
        params.set(CHAVE.aluno, id);
        params.delete(CHAVE.semestre);
      }),
    [escrever],
  );

  const setTipo = useCallback(
    (t: TipoConteudo) => escrever((params) => params.set(CHAVE.tipo, t)),
    [escrever],
  );

  const limparFiltroPagina = useCallback(
    () =>
      escrever((params) => {
        params.delete(CHAVE.aluno);
        params.delete(CHAVE.semestre);
      }),
    [escrever],
  );

  return {
    iesId,
    periodo,
    de: periodo === 'custom' ? deBruto : null,
    ate: periodo === 'custom' ? ateBruto : null,
    inicio,
    fim,
    semestre: lerSemestre(searchParams.get(CHAVE.semestre)),
    alunoId: searchParams.get(CHAVE.aluno) || null,
    tipo: ehTipo(tipoBruto) ? tipoBruto : 'todos',
    setPeriodo,
    setSemestre,
    setAluno,
    setTipo,
    limparFiltroPagina,
  };
}
