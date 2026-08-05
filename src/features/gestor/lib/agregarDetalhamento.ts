import type { CelulaAreaSemestre } from '../api/detalhamentoExtras';

type Area = { id: string; nome: string; acertoPct: number; critica: boolean };
type Semestre = { semestre: number; acertoPct: number; emEvidencia: boolean };

/** Áreas recalculadas para um semestre. Célula sem valor sai do recorte (§4.10). */
export function recalcularAreas(areas: Area[], matriz: CelulaAreaSemestre[], semestre: number): Area[] {
  return areas.flatMap((area) => {
    const celula = matriz.find((c) => c.areaId === area.id && c.semestre === semestre);
    if (!celula || celula.acertoPct === null) return [];
    return [{ ...area, acertoPct: celula.acertoPct }];
  });
}

/** Semestres recalculados para uma grande área. Célula sem valor sai do recorte (§4.10). */
export function recalcularSemestres(
  semestres: Semestre[],
  matriz: CelulaAreaSemestre[],
  areaId: string,
): Semestre[] {
  return semestres.flatMap((s) => {
    const celula = matriz.find((c) => c.areaId === areaId && c.semestre === s.semestre);
    if (!celula || celula.acertoPct === null) return [];
    return [{ ...s, acertoPct: celula.acertoPct }];
  });
}
