import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SimuladoMentor } from '@/features/mentor/api/types';
import { escreverParamSimulados, lerParamSimulados, type OrdemQuestoes } from './derivar';

const ORDENS: OrdemQuestoes[] = ['prova', 'erradas', 'acertadas'];

/**
 * Estado da tela na URL (docs/06 § Estado de UI): `?s=4,5` (simulados, por ordem), `ord` (ordenação das
 * questões), `area` (filtro de grande área das questões) e `ga` (grande área aberta no drawer).
 * `?aluno=` é do drawer do aluno montado no shell; aqui só é escrito para abri-lo.
 */
export function useEstadoUrl(simulados: SimuladoMentor[] | undefined) {
  const [params, setParams] = useSearchParams();
  const lista = React.useMemo(() => simulados ?? [], [simulados]);
  const sParam = params.get('s');
  const selecionados = React.useMemo(() => lerParamSimulados(sParam, lista), [sParam, lista]);

  const atualizar = React.useCallback(
    (mudar: (p: URLSearchParams) => void, replace = true) =>
      setParams((atual) => {
        const proximo = new URLSearchParams(atual);
        mudar(proximo);
        return proximo;
      }, { replace }),
    [setParams],
  );

  // Ao entrar sem `?s=`, a seleção padrão também vai para a URL (link colável desde o primeiro render).
  React.useEffect(() => {
    if (sParam === null && simulados && selecionados.length > 0) {
      atualizar((p) => p.set('s', escreverParamSimulados(selecionados, simulados)));
    }
  }, [sParam, simulados, selecionados, atualizar]);

  const ordBruto = params.get('ord') as OrdemQuestoes | null;
  return {
    selecionados,
    setSelecionados: (ids: string[]) => atualizar((p) => p.set('s', escreverParamSimulados(ids, lista))),
    ordem: ordBruto && ORDENS.includes(ordBruto) ? ordBruto : ('prova' as OrdemQuestoes),
    setOrdem: (o: OrdemQuestoes) => atualizar((p) => (o === 'prova' ? p.delete('ord') : p.set('ord', o))),
    area: params.get('area'),
    setArea: (a: string | null) => atualizar((p) => (a ? p.set('area', a) : p.delete('area'))),
    areaDrawer: params.get('ga'),
    setAreaDrawer: (a: string | null) => atualizar((p) => (a ? p.set('ga', a) : p.delete('ga')), false),
    abrirAluno: (email: string) => atualizar((p) => p.set('aluno', email), false),
  };
}
