import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { recalcularAreas, recalcularSemestres } from '../lib/agregarDetalhamento';
import { formatPct } from '../lib/formatters';
import type { CelulaAreaSemestre, RecorteCruzado } from '../api/detalhamentoExtras';
import type { AcertoPorAreaESemestre as AcertoPorAreaESemestreDados, FiltroSemestre } from '../api/types';

/**
 * Evidência derivada do filtro global (§4.5). O campo `emEvidencia` que vem no
 * envelope é o eco do servidor e não é usado para estilo — derivar no cliente
 * garante que a evidência nunca desincronize da URL.
 */
export function semestresEmEvidencia(semestre: FiltroSemestre, disponiveis: number[]): number[] {
  if (semestre === 'geral') return [...disponiveis];
  if (semestre === '6ano') return disponiveis.filter((s) => s === 11 || s === 12);
  const alvo = Number(semestre);
  return disponiveis.filter((s) => s === alvo);
}

export interface AcertoPorAreaESemestreProps {
  dados: AcertoPorAreaESemestreDados;
  semestre: FiltroSemestre;
  matriz?: CelulaAreaSemestre[];
  recorte?: RecorteCruzado | null;
  onRecorteChange?: (recorte: RecorteCruzado | null) => void;
}

const MOTIVO_SEM_MATRIZ = 'Recorte cruzado indisponível para esta seleção';

export function AcertoPorAreaESemestre({
  dados,
  semestre,
  matriz,
  recorte = null,
  onRecorteChange,
}: AcertoPorAreaESemestreProps) {
  const interativo = typeof onRecorteChange === 'function';
  const cruzamentoDisponivel = Boolean(matriz && matriz.length > 0);

  const areas =
    cruzamentoDisponivel && recorte?.tipo === 'semestre'
      ? recalcularAreas(dados.areas, matriz ?? [], Number(recorte.id))
      : dados.areas;

  const semestres =
    cruzamentoDisponivel && recorte?.tipo === 'area'
      ? recalcularSemestres(dados.semestres, matriz ?? [], recorte.id)
      : dados.semestres;

  const evidentes = semestresEmEvidencia(
    semestre,
    semestres.map((s) => s.semestre),
  );

  const alternar = (proximo: RecorteCruzado) => {
    if (!onRecorteChange) return;
    const igual = recorte?.tipo === proximo.tipo && recorte.id === proximo.id;
    onRecorteChange(igual ? null : proximo);
  };

  const rotuloRecorte =
    recorte === null
      ? null
      : recorte.tipo === 'semestre'
        ? `${recorte.id}º semestre`
        : (dados.areas.find((a) => a.id === recorte.id)?.nome ?? recorte.id);

  return (
    <section
      role="region"
      aria-label="Acerto por grande área e por semestre"
      className="space-y-6 rounded-lg border border-border bg-card p-4"
    >
      {rotuloRecorte && (
        <p data-testid="recorte-ativo" className="flex items-center gap-2 text-sm text-muted-foreground">
          Recorte: <strong className="text-foreground">{rotuloRecorte}</strong>
          <button
            type="button"
            onClick={() => onRecorteChange?.(null)}
            className="inline-flex items-center gap-1 rounded px-1 text-xs underline"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            limpar recorte
          </button>
        </p>
      )}

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Acerto por grande área</h3>
        {areas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dado de grande área neste recorte</p>
        ) : (
          <ul className="space-y-2">
            {areas.map((area) => {
              const ativo = recorte?.tipo === 'area' && recorte.id === area.id;
              const linha = (
                <>
                  {/* Task: contraste AA do nome da área crítica (texto, text-sm, peso normal —
                      mínimo 4,5:1). `text-destructive` reprovava contra os fundos reais deste
                      <span> — card (padrão) e card+primary/5% (recorte "ativo"): 3,78:1/3,48:1 no
                      claro, 3,48:1/3,40:1 no escuro. `gp-text-danger` resolve para --gp-danger-on:
                      11,09:1/10,20:1 no claro e 7,15:1/6,97:1 no escuro. Ver contrasteDestructive.test.tsx. */}
                  <span className={cn('truncate text-left text-sm', area.critica ? 'gp-text-danger' : 'text-foreground')}>
                    {area.nome}
                  </span>
                  <span className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'block h-full rounded-full transition-[width] duration-200',
                        area.critica ? 'bg-destructive' : 'bg-primary',
                      )}
                      style={{ width: `${Math.max(0, Math.min(100, area.acertoPct))}%` }}
                    />
                  </span>
                  <span
                    data-testid="area-valor"
                    className="text-right text-sm tabular-nums text-foreground transition-opacity duration-200"
                  >
                    {formatPct(area.acertoPct)}
                  </span>
                </>
              );

              return (
                <li
                  key={area.id}
                  data-testid={`area-${area.id}`}
                  data-critica={String(area.critica)}
                  data-recorte={ativo ? 'ativo' : 'inativo'}
                  className={cn('rounded', ativo && 'bg-primary/5 ring-1 ring-primary/30')}
                >
                  {interativo ? (
                    <button
                      type="button"
                      disabled={!cruzamentoDisponivel}
                      title={cruzamentoDisponivel ? undefined : MOTIVO_SEM_MATRIZ}
                      aria-pressed={ativo}
                      onClick={() => alternar({ tipo: 'area', id: area.id })}
                      className="grid w-full grid-cols-[10rem_1fr_3.5rem] items-center gap-3 px-1 py-1 disabled:cursor-default"
                    >
                      {linha}
                    </button>
                  ) : (
                    <div className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-3 px-1 py-1">{linha}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Acerto por semestre</h3>
        {semestres.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dado de semestre neste recorte</p>
        ) : (
          <ul className="flex items-end gap-3">
            {semestres.map((s) => {
              const emEvidencia = evidentes.includes(s.semestre);
              const ativo = recorte?.tipo === 'semestre' && recorte.id === String(s.semestre);
              const coluna = (
                <>
                  <span className="text-xs tabular-nums text-foreground transition-opacity duration-200">
                    {formatPct(s.acertoPct)}
                  </span>
                  <span className="flex h-32 w-full items-end rounded-t bg-muted">
                    <span
                      aria-hidden="true"
                      className="block w-full rounded-t bg-primary transition-[height] duration-200"
                      style={{ height: `${Math.max(0, Math.min(100, s.acertoPct))}%` }}
                    />
                  </span>
                  <span className="text-xs text-muted-foreground">{s.semestre}º semestre</span>
                </>
              );

              return (
                <li
                  key={s.semestre}
                  data-testid={`semestre-${s.semestre}`}
                  data-evidencia={String(emEvidencia)}
                  data-recorte={ativo ? 'ativo' : 'inativo'}
                  className={cn(
                    'flex flex-1 transition-opacity duration-200',
                    emEvidencia ? 'opacity-100' : 'opacity-40',
                    ativo && 'rounded bg-primary/5 ring-1 ring-primary/30',
                  )}
                >
                  {interativo ? (
                    <button
                      type="button"
                      disabled={!cruzamentoDisponivel}
                      title={cruzamentoDisponivel ? undefined : MOTIVO_SEM_MATRIZ}
                      aria-pressed={ativo}
                      onClick={() => alternar({ tipo: 'semestre', id: String(s.semestre) })}
                      className="flex w-full flex-col items-center gap-1 disabled:cursor-default"
                    >
                      {coluna}
                    </button>
                  ) : (
                    <div className="flex w-full flex-col items-center gap-1">{coluna}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
