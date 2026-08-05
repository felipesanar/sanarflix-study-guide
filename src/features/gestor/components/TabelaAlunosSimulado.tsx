import * as React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDelta, formatNumero } from '../lib/formatters';
import type { AlunoNoSimulado } from '../api/types';

export type ColunaOrdenavel = 'semestre' | 'acertos' | 'proficiencia' | 'variacao';
type Ordem = 'asc' | 'desc';

/**
 * `aguardando_resultado` é o 4º estado real (achado 03/08, `api/types.ts`):
 * aluno participou mas a nota TRI ainda não subiu pelo pipeline. Distinto de
 * `nao_participou` — aqui `acertos` já existe, só `proficiencia` fica null.
 */
const SITUACAO_ROTULO: Record<AlunoNoSimulado['situacao'], string> = {
  proficiente: 'Proficiente',
  abaixo_do_limiar: 'Abaixo do limiar',
  aguardando_resultado: 'Aguardando resultado',
  nao_participou: 'Não participou',
};

function valorDaColuna(aluno: AlunoNoSimulado, coluna: ColunaOrdenavel): number | null {
  if (coluna === 'semestre') return aluno.semestre;
  if (coluna === 'acertos') return aluno.acertos;
  if (coluna === 'proficiencia') return aluno.proficiencia;
  return aluno.variacao ?? null;
}

/** Ordena por coluna numérica com nulos **sempre** no fim, nas duas direções (§4.10). */
export function ordenarAlunosNoSimulado(
  alunos: AlunoNoSimulado[],
  coluna: ColunaOrdenavel,
  ordem: Ordem,
): AlunoNoSimulado[] {
  return [...alunos].sort((a, b) => {
    const va = valorDaColuna(a, coluna);
    const vb = valorDaColuna(b, coluna);
    if (va === null && vb === null) return a.nome.localeCompare(b.nome, 'pt-BR');
    if (va === null) return 1;
    if (vb === null) return -1;
    return ordem === 'desc' ? vb - va : va - vb;
  });
}

export interface TabelaAlunosSimuladoProps {
  alunos: AlunoNoSimulado[];
  multiSimulado: boolean;
  pageSize?: number;
  alunoSelecionadoId?: string | null;
  onSelecionarAluno?: (id: string) => void;
}

export function TabelaAlunosSimulado({
  alunos,
  multiSimulado,
  pageSize = 20,
  alunoSelecionadoId = null,
  onSelecionarAluno,
}: TabelaAlunosSimuladoProps) {
  const [ordenacao, setOrdenacao] = React.useState<{ coluna: ColunaOrdenavel; ordem: Ordem } | null>(null);
  const [ocultarNaoParticipantes, setOcultarNaoParticipantes] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const visiveis = React.useMemo(() => {
    const filtrados = ocultarNaoParticipantes ? alunos.filter((a) => a.participou) : alunos;
    return ordenacao ? ordenarAlunosNoSimulado(filtrados, ordenacao.coluna, ordenacao.ordem) : filtrados;
  }, [alunos, ocultarNaoParticipantes, ordenacao]);

  const totalPages = Math.max(1, Math.ceil(visiveis.length / pageSize));
  const pageAtual = Math.min(page, totalPages);
  const daPagina = visiveis.slice((pageAtual - 1) * pageSize, pageAtual * pageSize);

  const alternarOrdenacao = (coluna: ColunaOrdenavel) => {
    setPage(1);
    setOrdenacao((atual) =>
      atual?.coluna === coluna ? { coluna, ordem: atual.ordem === 'desc' ? 'asc' : 'desc' } : { coluna, ordem: 'desc' },
    );
  };

  const ariaSort = (coluna: ColunaOrdenavel) => {
    if (ordenacao?.coluna !== coluna) return 'none' as const;
    return ordenacao.ordem === 'desc' ? ('descending' as const) : ('ascending' as const);
  };

  const CabecalhoOrdenavel = ({ coluna, rotulo }: { coluna: ColunaOrdenavel; rotulo: string }) => (
    <TableHead aria-sort={ariaSort(coluna)} className="text-right">
      <button
        type="button"
        onClick={() => alternarOrdenacao(coluna)}
        className="inline-flex w-full items-center justify-end gap-1"
      >
        {rotulo}
        {ordenacao?.coluna === coluna &&
          (ordenacao.ordem === 'desc' ? (
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
          ))}
      </button>
    </TableHead>
  );

  return (
    <section aria-label="Visão de alunos do recorte" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">Visão de alunos</h3>
        <div className="flex items-center gap-2">
          <Switch
            id="ocultar-nao-participantes"
            checked={ocultarNaoParticipantes}
            onCheckedChange={(v) => {
              setOcultarNaoParticipantes(v);
              setPage(1);
            }}
          />
          <Label htmlFor="ocultar-nao-participantes" className="text-sm">
            Ocultar não participantes
          </Label>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <CabecalhoOrdenavel coluna="semestre" rotulo="Semestre" />
              <CabecalhoOrdenavel coluna="acertos" rotulo="Número de acertos" />
              <CabecalhoOrdenavel coluna="proficiencia" rotulo="Proficiência" />
              <TableHead>Situação</TableHead>
              {multiSimulado && <CabecalhoOrdenavel coluna="variacao" rotulo="Variação" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {daPagina.map((a) => {
              const selecionado = a.id === alunoSelecionadoId;
              return (
                <TableRow
                  key={a.id}
                  data-testid={`linha-aluno-${a.id}`}
                  data-selecionado={String(selecionado)}
                  className={cn(selecionado && 'bg-primary/5')}
                >
                  <TableCell className="relative">
                    {selecionado && (
                      <span
                        data-testid="marca-selecao"
                        aria-hidden="true"
                        className="absolute left-0 top-0 h-full w-0.5 bg-primary"
                      />
                    )}
                    <span data-testid="celula-nome">
                      {onSelecionarAluno ? (
                        <button type="button" onClick={() => onSelecionarAluno(a.id)} className="underline">
                          {a.nome}
                        </button>
                      ) : (
                        a.nome
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.semestre}º</TableCell>
                  <TableCell data-testid="celula-acertos" className="text-right tabular-nums">
                    {formatNumero(a.acertos)}
                  </TableCell>
                  <TableCell data-testid="celula-proficiencia" className="text-right tabular-nums">
                    {formatNumero(a.proficiencia)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.participou ? 'secondary' : 'outline'}>{SITUACAO_ROTULO[a.situacao]}</Badge>
                  </TableCell>
                  {multiSimulado && (
                    <TableCell data-testid="celula-variacao" className="text-right tabular-nums">
                      {formatDelta(a.variacao ?? null)}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div data-testid="paginacao" className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
        <span>
          Página {pageAtual} de {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={pageAtual === 1} onClick={() => setPage(pageAtual - 1)}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={pageAtual === totalPages} onClick={() => setPage(pageAtual + 1)}>
          Próxima
        </Button>
      </div>
    </section>
  );
}
