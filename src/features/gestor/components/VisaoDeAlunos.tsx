import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DispersaoChart } from '@/features/gestor/charts/DispersaoChart';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { formatNumero, formatPct, rotuloGrupo } from '@/features/gestor/lib/formatters';
import type { GrupoEvolucao, VisaoGeral } from '@/features/gestor/api/types';

export interface VisaoDeAlunosProps {
  distribuicao: VisaoGeral['distribuicaoAlunos'];
  dispersao: VisaoGeral['dispersao'];
  /**
   * §4.11: calculada e armazenada no backend, nunca no cliente. Ausente/`null`
   * é um recorte legítimo — `DispersaoChart` já degrada sem quebrar.
   */
  tendencia?: { semestre: number; nota: number }[] | null;
  /** Chamado com o `alunoId` de um ponto da dispersão, se o consumidor quiser abrir o drawer do aluno. */
  onSelecionarAluno?: (alunoId: string) => void;
}

/** Ordem fixa de exibição dos 3 grupos de evolução (mesmo espírito do `ORDEM_NIVEL` de `CascataDiagnostico`). */
const ORDEM_GRUPO: GrupoEvolucao[] = [
  'consistentemente_proficiente',
  'em_variacao',
  'consistentemente_nao_proficiente',
];

const CORES_GRUPO: Record<GrupoEvolucao, string> = {
  consistentemente_proficiente: 'bg-emerald-600',
  em_variacao: 'bg-amber-500',
  consistentemente_nao_proficiente: 'bg-red-600',
};

/**
 * Bloco "Visão de Alunos" (resumo) da Visão Geral (spec §4.8): distribuição
 * por grupo de evolução + dispersão de proficiência por semestre, com linha
 * de tendência quando o backend a fornece. Bloco macro — vem ACIMA do
 * diagnóstico por grande área (dado mais agregado antes do mais específico).
 */
export function VisaoDeAlunos({ distribuicao, dispersao, tendencia, onSelecionarAluno }: VisaoDeAlunosProps) {
  const porGrupo = new Map(distribuicao.map((item) => [item.grupo, item]));

  return (
    <section data-testid="bloco-visao-alunos" aria-labelledby="titulo-visao-alunos" className="space-y-3">
      <div>
        <h2 id="titulo-visao-alunos" className="text-sm font-semibold">
          Visão de Alunos
        </h2>
        <p className="text-xs text-muted-foreground">
          Distribuição por grupo de evolução e dispersão de proficiência por semestre.
        </p>
      </div>

      <Card data-testid="distribuicao-alunos">
        <CardContent className="p-4">
          {distribuicao.length === 0 ? (
            <div data-testid="distribuicao-vazia">
              <EstadoVazio titulo="Sem alunos com resultado neste recorte" className="border-none p-0" />
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {ORDEM_GRUPO.map((grupo) => {
                const item = porGrupo.get(grupo);
                const quantidade = item?.quantidade ?? null;
                const percentual = item?.percentual ?? null;
                return (
                  <li key={grupo}>
                    <div data-testid={`grupo-${grupo}`} className="space-y-2 rounded-md border border-border p-3">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${CORES_GRUPO[grupo]}`} />
                        {rotuloGrupo(grupo)}
                      </span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tabular-nums">{formatNumero(quantidade)}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{formatPct(percentual)}</span>
                      </span>
                      <div
                        role="progressbar"
                        aria-label={`Participação de ${rotuloGrupo(grupo)}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        /**
                         * `percentual: null` é ausência de medida, não zero
                         * (§4.10). Omitir `aria-valuenow` deixa a progressbar
                         * INDETERMINADA por WAI-ARIA — o leitor de tela não
                         * anuncia "0 por cento" para dado que ninguém mediu,
                         * igual ao rótulo visível, que já mostra TRACO. A
                         * largura da barra cai a 0 porque é só decoração.
                         */
                        aria-valuenow={percentual === null ? undefined : Math.round(percentual)}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className={`h-full rounded-full ${CORES_GRUPO[grupo]}`}
                          style={{ width: `${percentual ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card data-testid="dispersao-alunos">
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold">Proficiência por semestre</span>
        </CardHeader>
        <CardContent>
          <DispersaoChart pontos={dispersao} tendencia={tendencia} onSelecionarAluno={onSelecionarAluno} />
        </CardContent>
      </Card>
    </section>
  );
}
