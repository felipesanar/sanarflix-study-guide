import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { useAluno } from '@/features/gestor/api/queries';
import { TRACO, formatData, formatDelta, formatNumero, formatPct, rotuloSituacao } from '@/features/gestor/lib/formatters';

export interface DrawerAlunoProps {
  alunoId: string | null;
  nome: string;
  /** Ids dos simulados em foco no recorte — vão direto para `useAluno`. */
  simulados: string[];
  onFechar: () => void;
}

/**
 * Visão detalhada de um aluno (spec §4.8).
 *
 * `useAluno` devolve **uma entrada por simulado** (`AlunoSimuladoEntry[]`),
 * nunca um objeto singular — a RPC materializa isso via `jsonb_agg`. Cada
 * entrada aqui vira a SUA PRÓPRIA seção: nenhum campo é somado, tirado média
 * ou fundido entre simulados (regra de "agregação honesta" do handoff —
 * mesma família de decisão de "Conceito ENAMED não tem média").
 *
 * Uma única coluna de escala 0–100 por simulado, rotulada Proficiência —
 * nenhum rótulo "Nota TRI" nesta tela (spec §4.1, caso crítico nº2).
 */
export function DrawerAluno({ alunoId, nome, simulados, onFechar }: DrawerAlunoProps) {
  const consulta = useAluno(alunoId, simulados);
  const entradas = consulta.data ?? [];

  if (!alunoId) return null;

  const semestre = entradas[0]?.semestre ?? null;

  return (
    <Sheet
      open
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{nome}</SheetTitle>
          <SheetDescription>
            {consulta.isLoading
              ? 'Carregando dados do aluno'
              : semestre !== null
                ? `${semestre}º semestre`
                : TRACO}
          </SheetDescription>
        </SheetHeader>

        {consulta.isLoading ? (
          <div className="space-y-2">
            <GestorSkeleton altura={96} rotulo="Carregando dados do aluno" />
            <GestorSkeleton altura={96} rotulo="Carregando dados do aluno" />
          </div>
        ) : consulta.isError ? (
          <EstadoErro titulo="Não foi possível carregar este aluno." onRetry={() => consulta.refetch()} />
        ) : entradas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum simulado neste recorte"
            descricao="Ajuste o recorte de simulados para ver os dados deste aluno."
          />
        ) : (
          <div className="flex-1 space-y-4">
            {entradas.map((entrada) => (
              <article
                key={entrada.simuladoId}
                data-testid={`drawer-simulado-${entrada.simuladoId}`}
                className="space-y-3 rounded-lg border border-border p-3"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{entrada.simuladoNome}</h3>
                    <p className="text-xs text-muted-foreground">{formatData(entrada.simuladoData)}</p>
                  </div>
                  <Badge variant="secondary">{rotuloSituacao(entrada.situacao)}</Badge>
                </header>

                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Proficiência</dt>
                    <dd
                      data-testid={`drawer-proficiencia-${entrada.simuladoId}`}
                      className="text-xl font-semibold tabular-nums"
                    >
                      {formatNumero(entrada.proficiencia)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Acertos</dt>
                    <dd className="text-xl font-semibold tabular-nums">{formatNumero(entrada.acertos)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Posição</dt>
                    <dd className="text-sm tabular-nums">
                      {entrada.posicao ? `${entrada.posicao.lugar}º de ${entrada.posicao.total}` : TRACO}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Variação</dt>
                    <dd className="text-sm tabular-nums">{formatDelta(entrada.variacao ?? null)}</dd>
                  </div>
                </dl>

                {entrada.acertoPorArea && entrada.acertoPorArea.length > 0 ? (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground">
                      Desempenho por grande área (% de acerto)
                    </h4>
                    <ul className="space-y-1">
                      {entrada.acertoPorArea.map((area) => (
                        <li
                          key={area.area}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{area.area}</span>
                            {area.critica ? (
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                área crítica
                              </Badge>
                            ) : null}
                          </span>
                          <span className="shrink-0 tabular-nums">{formatPct(area.acertoPct)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
