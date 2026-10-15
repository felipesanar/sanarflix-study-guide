import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { previaEmUmaLinha } from '@/features/mentor/lib/textoSeguro';
import type { QuestaoDetalhe } from '@/services/mentor/desempenho';
import {
  ORDENACOES,
  classeAcerto,
  formatPct,
  formatRespostas,
  ordenarQuestoes,
  rotuloSimulado,
  temaExibido,
  type OrdenacaoQuestoes,
} from './util';

const PAGINA = 20;

interface Props {
  questoes: QuestaoDetalhe[];
  /** Com mais de um simulado no recorte, o número da questão vem acompanhado do simulado. */
  multiSimulado: boolean;
  onAbrir: (questao: QuestaoDetalhe) => void;
}

/**
 * Detalhamento das questões: filtro por grande área, três ordenações e
 * abertura da questão. Versão enxuta da TabelaQuestoes do Gestor (aquela
 * depende de filtros globais, metas e do drawer de alunos do gestor).
 */
export const ListaQuestoes: React.FC<Props> = ({ questoes, multiSimulado, onAbrir }) => {
  const [area, setArea] = React.useState('todas');
  const [ordem, setOrdem] = React.useState<OrdenacaoQuestoes>('ordem_da_prova');
  const [limite, setLimite] = React.useState(PAGINA);

  const areas = React.useMemo(
    () => [...new Set(questoes.map((q) => q.grande_area))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [questoes],
  );
  const visiveis = React.useMemo(
    () => ordenarQuestoes(area === 'todas' ? questoes : questoes.filter((q) => q.grande_area === area), ordem),
    [questoes, area, ordem],
  );

  return (
    <section aria-label="Detalhamento das questões" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Detalhamento das questões</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Filtrar por grande área</span>
            <select
              aria-label="Filtrar por grande área"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setLimite(PAGINA);
              }}
            >
              <option value="todas">Todas as grandes áreas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Ordenar questões" className="inline-flex rounded-md border">
            {ORDENACOES.map((o) => (
              <button
                key={o.valor}
                type="button"
                aria-pressed={ordem === o.valor}
                onClick={() => setOrdem(o.valor)}
                className={cn(
                  'px-3 py-1.5 text-sm first:rounded-l-md last:rounded-r-md',
                  ordem === o.valor ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma questão nesta grande área.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {visiveis.slice(0, limite).map((q) => {
            const previa = previaEmUmaLinha(q.enunciado_inicio);
            return (
              <li key={q.questao_id}>
                <button
                  type="button"
                  onClick={() => onAbrir(q)}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 p-3 text-left hover:bg-muted/50 sm:grid-cols-[8rem_1fr_10rem_5rem_6rem]"
                >
                  <span className="font-medium">
                    {multiSimulado ? (
                      <>
                        Q{q.numero} <span className="text-xs text-muted-foreground">{rotuloSimulado(q.sequence_number)}</span>
                      </>
                    ) : (
                      <>Q{q.numero}</>
                    )}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block truncate text-sm">{temaExibido(q)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {q.especialidade ? `${q.grande_area} · ${q.especialidade}` : q.grande_area}
                    </span>
                    {previa && (
                      <span className="block truncate text-xs text-muted-foreground/80" data-testid="previa-enunciado">
                        {q.tem_imagem ? <span className="sr-only">Com imagem. </span> : null}
                        {previa}
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:block" aria-hidden="true">
                    <span className="block h-2 rounded-full bg-muted">
                      <span
                        className={cn('block h-2 rounded-full', classeAcerto(q.acerto_pct))}
                        style={{ width: `${Math.min(100, Math.max(0, q.acerto_pct))}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-right text-sm font-semibold">{formatPct(q.acerto_pct)}</span>
                  <span className="hidden text-right text-xs text-muted-foreground sm:block">
                    {formatRespostas(q.respostas)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {visiveis.length > limite && (
        <Button type="button" variant="outline" size="sm" onClick={() => setLimite((l) => l + PAGINA)}>
          Mostrar mais
        </Button>
      )}
    </section>
  );
};
