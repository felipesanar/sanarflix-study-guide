import * as React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { dec1, deltaPp, mesAno } from '@/features/gestor/lib/engajamento';
import { formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';
import type { AdminEngajamento, LinhaRankingIes } from '@/features/gestor/api/types-engajamento';

export interface RankingIesProps {
  ranking: LinhaRankingIes[];
  rede: AdminEngajamento['rede'];
}

type Criterio = 'engajamento' | 'acerto' | 'base';

const CRITERIOS: Array<{ id: Criterio; rotulo: string }> = [
  { id: 'engajamento', rotulo: 'Engajamento' },
  { id: 'acerto', rotulo: 'Acerto' },
  { id: 'base', rotulo: 'Base ativa' },
];

/** Proficiência abaixo disto fica em `text-destructive` (§12.5). */
const PROFICIENCIA_ALERTA = 40;

const valorDe = (l: LinhaRankingIes, c: Criterio): number | null =>
  c === 'engajamento' ? l.engajadosPct : c === 'acerto' ? l.acertoPct : l.base;

/** Decrescente pelo critério; sem valor vai para o fim; empate pelo nome (P14). */
export function ordenarRanking(ranking: LinhaRankingIes[], criterio: Criterio): LinhaRankingIes[] {
  return [...ranking].sort((a, b) => {
    const va = valorDe(a, criterio);
    const vb = valorDe(b, criterio);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) return vb - va;
    return a.nome.localeCompare(b.nome);
  });
}

function BarraEngajados({ pct, media }: { pct: number | null; media: number | null }) {
  const limitar = (v: number) => Math.min(100, Math.max(0, v));
  return (
    <span aria-hidden="true" className="relative block h-2 w-full rounded-full bg-muted">
      <span className="absolute left-0 top-0 block h-full rounded-full bg-primary" style={{ width: `${limitar(pct ?? 0)}%` }} />
      {media !== null ? (
        <span
          data-testid="traco-media-rede"
          className="absolute -top-[3px] block h-3.5 w-0.5 bg-foreground"
          style={{ left: `${limitar(media)}%`, transform: 'translateX(-1px)' }}
        />
      ) : null}
    </span>
  );
}

function Tendencia({ linha }: { linha: LinhaRankingIes }) {
  const texto = deltaPp(linha.engajadosPct, linha.engajadosPctAnterior);
  if (texto === null) return <span className="text-muted-foreground">{TRACO}</span>;
  // Sem verde (identidade visual): queda em destaque, o resto no texto normal.
  return <span className={cn('whitespace-nowrap', texto.startsWith('▼') ? 'text-destructive' : 'text-foreground')}>{texto}</span>;
}

/**
 * "Ranking de IES" (spec §12.5): uma linha por instituição com engajamento, sumidos,
 * consumo, acerto, proficiência e tendência. Ordena por Engajamento (padrão), Acerto ou
 * Base ativa, sempre decrescente, e renumera a posição. Só agregados por IES.
 */
export function RankingIes({ ranking, rede }: RankingIesProps) {
  const [criterio, setCriterio] = React.useState<Criterio>('engajamento');
  const linhas = React.useMemo(() => ordenarRanking(ranking, criterio), [ranking, criterio]);

  return (
    <section aria-labelledby="titulo-ranking-ies" className="rounded-xl border bg-card p-4" data-testid="ranking-ies">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="titulo-ranking-ies" className="text-base font-semibold">
          Ranking de IES
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ordenar por:</span>
          <div role="group" aria-label="Ordenar ranking por" className="inline-flex gap-1.5">
            {CRITERIOS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={criterio === c.id}
                onClick={() => setCriterio(c.id)}
                className={cn(
                  'h-8 rounded-full border px-3 text-xs font-medium',
                  criterio === c.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table aria-label="Ranking de IES" className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="w-8 py-2 pr-2 font-medium">#</th>
              <th scope="col" className="py-2 pr-3 font-medium">Instituição</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Base ativa</th>
              <th scope="col" className="py-2 pr-3 font-medium">Engajados</th>
              <th scope="col" className="py-2 pr-3 font-medium">% Alunos proficientes*</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Sumidos 30+d</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Vídeos / aluno</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Questões / aluno</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Acerto</th>
              <th scope="col" className="py-2 pr-3 font-medium">Tendência</th>
              <th scope="col" className="py-2 font-medium"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const sumidosAlto = rede.semRetorno30Pct !== null && l.semRetorno30Pct !== null && l.semRetorno30Pct > rede.semRetorno30Pct;
              const prof = l.proficiencia;
              return (
                <tr key={l.iesId} data-testid="linha-ranking" className="border-b last:border-b-0 align-top">
                  <td className="py-2.5 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium">{l.nome}</th>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumero(l.base)}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex min-w-[140px] items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <BarraEngajados pct={l.engajadosPct} media={rede.engajadosPct} />
                      </div>
                      <span className="min-w-[34px] text-right tabular-nums">{formatPct(l.engajadosPct)}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    {prof ? (
                      <>
                        <span data-testid="proficiencia-valor" className={cn('tabular-nums', prof.pct !== null && prof.pct < PROFICIENCIA_ALERTA && 'text-destructive')}>
                          {formatPct(prof.pct)}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {prof.simuladoNome} · {mesAno(prof.dataReferencia.slice(0, 7))}
                        </div>
                      </>
                    ) : (
                      <>
                        <span data-testid="proficiencia-valor">{TRACO}</span>
                        <div className="text-xs text-muted-foreground">sem simulado ENAMED</div>
                      </>
                    )}
                  </td>
                  <td className={cn('py-2.5 pr-3 text-right tabular-nums', sumidosAlto && 'font-semibold text-destructive')} data-testid="sumidos-30">
                    {formatPct(l.semRetorno30Pct)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{dec1(l.videosPorEngajado)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumero(l.questoesPorEngajado)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatPct(l.acertoPct)}</td>
                  <td className="py-2.5 pr-3"><Tendencia linha={l} /></td>
                  <td className="py-2.5 text-right">
                    <Link
                      to={`/gestor/engajamento?ies=${l.iesId}`}
                      aria-label={`Abrir portal de ${l.nome}`}
                      className="whitespace-nowrap text-primary underline-offset-2 hover:underline"
                    >
                      Abrir portal →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>
          Traço preto = média da rede ({formatPct(rede.engajadosPct)}). Tendência = variação do engajamento vs. o período anterior de mesma duração.
        </p>
        <p>
          * % de alunos proficientes no simulado mais recente que a IES realizou conosco (nome e data abaixo do valor). Por isso as IES podem estar comparadas em simulados diferentes. Esse número não muda com o filtro de semestre nem de período.
        </p>
      </div>
    </section>
  );
}
