import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { StatusBadge, type StatusLevel } from '@/experiences/gestor/ui';
import type { AlunoRiscoRow, GapSeverity } from './useAlunosRisco';
import { TRI_PROFICIENCY_THRESHOLD } from './useAlunosRisco';

const PAGE_SIZE = 25;

interface AlunosRiscoTableProps {
  rows: AlunoRiscoRow[];
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function gapColorClass(severity: GapSeverity): string {
  if (severity === 'critico') return 'text-red-600 dark:text-red-400';
  if (severity === 'atencao') return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function consumoColorClass(horas: number | null): string {
  if (horas === null) return 'text-muted-foreground';
  if (horas < 25) return 'text-red-600 dark:text-red-400';
  if (horas < 45) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function consumoBarClass(horas: number | null): string {
  if (horas === null) return 'bg-muted';
  if (horas < 25) return 'bg-red-500';
  if (horas < 45) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function statusFromRow(row: AlunoRiscoRow): StatusLevel {
  if (row.segmento === 'proficiente') return 'proficiente';
  if (row.segmento === 'proximo') return 'proximo';
  return 'critico';
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Tabela de alunos da tela Alunos & Risco. Busca por nome client-side
 * (debounced) e paginação de 25 (padrão `UsersListTable`). Colunas: aluno
 * (avatar + nome), semestre, TRI, gap até 500, consumo (horas do período) e
 * status.
 */
export const AlunosRiscoTable: React.FC<AlunosRiscoTableProps> = ({ rows }) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, rows.length]);

  const filtered = useMemo(() => {
    const q = normalize(searchTerm.trim());
    if (!q) return rows;
    return rows.filter((r) => normalize(r.nome).includes(q));
  }, [rows, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const showingTo = Math.min((currentPage + 1) * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-3">
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Buscar aluno por nome..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-9 pr-8 text-sm"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Aluno</TableHead>
              <TableHead className="w-16 text-center">Sem.</TableHead>
              <TableHead className="w-20 text-right">TRI</TableHead>
              <TableHead className="w-28 text-right">Gap até {TRI_PROFICIENCY_THRESHOLD}</TableHead>
              <TableHead className="w-40">Consumo</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  Nenhum aluno encontrado.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[11px] font-semibold">{initials(row.nome)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-medium text-foreground">{row.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm font-mono tabular-nums text-muted-foreground">
                    {row.semestre}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">
                    {row.hasTri ? row.score.toFixed(0) : '—'}
                  </TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums text-sm font-medium', gapColorClass(row.gapSeverity))}>
                    {row.gap > 0 ? row.gap.toFixed(0) : '0'}
                  </TableCell>
                  <TableCell>
                    {row.horasPeriodo === null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', consumoBarClass(row.horasPeriodo))}
                            style={{ width: `${Math.min(100, (row.horasPeriodo / 60) * 100)}%` }}
                          />
                        </div>
                        <span className={cn('font-mono tabular-nums text-xs', consumoColorClass(row.horasPeriodo))}>
                          {row.horasPeriodo.toFixed(0)}h
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={statusFromRow(row)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            Mostrando {showingFrom}-{showingTo} de {filtered.length} alunos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[90px] text-center text-xs text-muted-foreground">
              Página {currentPage + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
