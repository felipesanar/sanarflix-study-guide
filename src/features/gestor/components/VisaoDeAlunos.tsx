import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DispersaoChart } from '@/features/gestor/charts/DispersaoChart';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { Icon } from '@/features/gestor/components/Icon';
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
  /**
   * Âncora da tabela de alunos na mesma tela — destino do "Ver visão detalhada".
   * A copy é fechada no handoff (docs/01, §Copy): nunca "drill-down".
   */
  alvoDetalhe?: string;
}

/** Ordem fixa de exibição dos 3 grupos de evolução (mesmo espírito do `ORDEM_NIVEL` de `CascataDiagnostico`). */
const ORDEM_GRUPO: GrupoEvolucao[] = [
  'consistentemente_proficiente',
  'em_variacao',
  'consistentemente_nao_proficiente',
];

/**
 * Semáforo dos 3 grupos por token semântico. Antes eram classes de paleta crua
 * do Tailwind (`bg-emerald-600`/`bg-amber-500`/`bg-red-600`), que não existem no
 * tema do portal: não acompanhavam o tema escuro nem a calibragem de contraste
 * feita nos tokens `--gp-*`.
 */
const COR_GRUPO: Record<GrupoEvolucao, string> = {
  consistentemente_proficiente: 'var(--gp-success)',
  em_variacao: 'var(--gp-warning)',
  consistentemente_nao_proficiente: 'var(--gp-danger)',
};

/**
 * Bloco "Visão de Alunos" (resumo) da Visão Geral (spec §4.8): distribuição
 * por grupo de evolução + dispersão de proficiência por semestre, com linha
 * de tendência quando o backend a fornece. Vem DEPOIS do Diagnóstico
 * Curricular — a referência promove o diagnóstico para logo abaixo do gráfico
 * protagonista (`<!-- Diagnóstico (promovido) -->`).
 */
export function VisaoDeAlunos({
  distribuicao,
  dispersao,
  tendencia,
  onSelecionarAluno,
  alvoDetalhe = '#alunos-detalhe',
}: VisaoDeAlunosProps) {
  const porGrupo = new Map(distribuicao.map((item) => [item.grupo, item]));

  return (
    <section data-testid="bloco-visao-alunos" aria-labelledby="titulo-visao-alunos" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="titulo-visao-alunos" style={{ fontSize: 16, fontWeight: 700 }}>
          Visão de Alunos
        </h2>
        <a
          href={alvoDetalhe}
          data-testid="link-visao-detalhada"
          className="ml-auto inline-flex items-center gap-1 whitespace-nowrap underline-offset-4 hover:underline"
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-brand-on-dark)' }}
        >
          Ver visão detalhada
          <Icon name="chevron_right" size={14} />
        </a>
        <p className="w-full text-xs text-muted-foreground">
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
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ background: COR_GRUPO[grupo] }}
                        />
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
                          className="h-full rounded-full"
                          style={{ width: `${percentual ?? 0}%`, background: COR_GRUPO[grupo] }}
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
