import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DistribuicaoAlternativas } from '../charts/DistribuicaoAlternativas';
import { formatPct } from '../lib/formatters';
import type { Questao } from '../api/types';

export const ORDENACOES_QUESTOES = [
  { valor: 'ordem_da_prova', rotulo: 'Ordem da prova' },
  { valor: 'mais_erradas', rotulo: 'Mais erradas' },
  { valor: 'mais_acertadas', rotulo: 'Mais acertadas' },
] as const;

export type OrdenacaoQuestoes = (typeof ORDENACOES_QUESTOES)[number]['valor'];

/** §4.7.3-4: o Detalhamento das Questões existe só com exatamente 1 simulado. */
export function deveMostrarQuestoes(simulados: string[]): boolean {
  return simulados.length === 1;
}

export interface TabelaQuestoesProps {
  questoes: Questao[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  ordenacao: OrdenacaoQuestoes;
  onOrdenacaoChange: (ordenacao: OrdenacaoQuestoes) => void;
  areas: string[];
  areaSelecionada: string | null;
  onAreaChange: (area: string | null) => void;
  processando?: boolean;
}

export function TabelaQuestoes({
  questoes,
  total,
  page,
  pageSize,
  onPageChange,
  ordenacao,
  onOrdenacaoChange,
  areas,
  areaSelecionada,
  onAreaChange,
  processando = false,
}: TabelaQuestoesProps) {
  const [expandida, setExpandida] = React.useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section aria-labelledby="questoes-titulo" className="space-y-3">
      <h3 id="questoes-titulo" className="text-base font-semibold text-foreground">
        Detalhamento das questões
      </h3>

      {processando ? (
        <p
          data-testid="questoes-processando"
          className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
        >
          Gabarito em processamento — as questões aparecem quando o processamento terminar.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Grande área</span>
              <ToggleGroup
                type="single"
                value={areaSelecionada ?? 'todas'}
                onValueChange={(v) => onAreaChange(!v || v === 'todas' ? null : v)}
                aria-label="Filtrar por grande área"
              >
                <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
                {areas.map((area) => (
                  <ToggleGroupItem key={area} value={area}>
                    {area}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ordenar por</span>
              <ToggleGroup
                type="single"
                value={ordenacao}
                onValueChange={(v) => v && onOrdenacaoChange(v as OrdenacaoQuestoes)}
                aria-label="Ordenação das questões"
              >
                {ORDENACOES_QUESTOES.map((o) => (
                  <ToggleGroupItem key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Nº</TableHead>
                  <TableHead>Grande área</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead className="text-right">Índice de acerto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questoes.map((q) => {
                  const aberta = expandida === q.numero;
                  return (
                    <React.Fragment key={q.numero}>
                      <TableRow data-testid={`linha-questao-${q.numero}`}>
                        <TableCell>
                          <button
                            type="button"
                            aria-expanded={aberta}
                            aria-controls={`detalhe-questao-${q.numero}`}
                            aria-label={`Ver detalhe da questão ${q.numero}`}
                            onClick={() => setExpandida(aberta ? null : q.numero)}
                            className="inline-flex items-center gap-1 tabular-nums"
                          >
                            {aberta ? (
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            )}
                            {q.numero}
                          </button>
                        </TableCell>
                        <TableCell>{q.grandeArea}</TableCell>
                        <TableCell>{q.especialidade}</TableCell>
                        <TableCell>{q.tema}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPct(q.acertoPct)}</TableCell>
                      </TableRow>
                      {aberta && (
                        <TableRow>
                          <TableCell colSpan={5} id={`detalhe-questao-${q.numero}`} data-testid={`detalhe-questao-${q.numero}`}>
                            <p className="mb-3 whitespace-pre-line text-sm text-foreground">{q.enunciado}</p>
                            <DistribuicaoAlternativas
                              alternativas={q.alternativas}
                              distratorDominante={q.distratorDominante}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
            <span>
              Página {page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              Próxima
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
