import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { StatusBadge, MetricValue, type StatusLevel } from '@/experiences/gestor/ui';
import type { StudentGrowthEntry } from '@/services/institutional';
import type { AlunoRiscoRow, GapSeverity } from './useAlunosRisco';
import { TRI_PROFICIENCY_THRESHOLD } from './useAlunosRisco';

interface AlunoDetailSheetProps {
  row: AlunoRiscoRow | null;
  growthByStudentId: Map<string, StudentGrowthEntry>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Iniciais do nome (até 2 letras) para o avatar — mesma regra da tabela. */
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

function statusFromRow(row: AlunoRiscoRow): StatusLevel {
  if (row.segmento === 'proficiente') return 'proficiente';
  if (row.segmento === 'proximo') return 'proximo';
  return 'critico';
}

/** Cor semântica do delta de evolução: emerald se melhora, red se piora, muted se neutro/ausente. */
function deltaColorClass(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || delta === 0) return 'text-muted-foreground';
  return delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
}

function DeltaIcon({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined || delta === 0) return <Minus className="h-3.5 w-3.5" />;
  return delta > 0
    ? <TrendingUp className="h-3.5 w-3.5" />
    : <TrendingDown className="h-3.5 w-3.5" />;
}

/**
 * Deriva 1-3 sugestões de "próximos passos" a partir dos dados já calculados
 * da row (sem chamar API nova). Lógica:
 * - segmento crítico → prioridade de intervenção imediata;
 * - gap pequeno (severidade 'ok') e não crítico → candidato a reforço pontual/tutoria de resgate;
 * - baixo engajamento (horasPeriodo < 25, mesmo limiar de `consumoColorClass` da tabela) → investigar adesão.
 * Sempre no máximo 3 bullets; se nenhuma condição bater, cai num fallback neutro de acompanhamento.
 */
function proximosPassos(row: AlunoRiscoRow): string[] {
  const passos: string[] = [];

  if (row.segmento === 'critico') {
    passos.push('Risco crítico — priorizar intervenção imediata.');
  } else if (row.gapSeverity === 'ok') {
    passos.push('Perto da proficiência — reforço pontual pode destravar.');
  } else if (row.segmento === 'proximo') {
    passos.push('Candidato a tutoria de resgate.');
  }

  if (row.horasPeriodo !== null && row.horasPeriodo < 25) {
    passos.push('Baixo engajamento na plataforma — investigar adesão.');
  }

  if (passos.length === 0) {
    passos.push('Sem sinais de risco imediato — manter acompanhamento de rotina.');
  }

  return passos.slice(0, 3);
}

/**
 * Sheet lateral de detalhe do aluno, aberto ao clicar numa linha da tabela de
 * Alunos & Risco. Mostra apenas dados já calculados client-side (TRI/score,
 * engajamento, evolução TRI via `growthByStudentId`) — nenhuma chamada nova.
 */
export const AlunoDetailSheet: React.FC<AlunoDetailSheetProps> = ({ row, growthByStudentId, open, onOpenChange }) => {
  const growth = row ? growthByStudentId.get(row.key) : undefined;

  const usesTheta = growth && growth.first_theta !== null && growth.last_theta !== null;
  const usesEnamed = !usesTheta && growth && growth.first_score_enamed !== null && growth.last_score_enamed !== null;
  const hasGrowth = usesTheta || usesEnamed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {row && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-xs font-semibold">{initials(row.nome)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{row.nome}</SheetTitle>
                  <SheetDescription>{row.semestre}º semestre</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* TRI, gap e status */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">TRI</p>
                  <MetricValue size="lg">{row.hasTri ? row.score.toFixed(0) : '—'}</MetricValue>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Gap até {TRI_PROFICIENCY_THRESHOLD}
                  </p>
                  <MetricValue size="lg" className={gapColorClass(row.gapSeverity)}>
                    {row.gap > 0 ? row.gap.toFixed(0) : '0'}
                  </MetricValue>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <StatusBadge status={statusFromRow(row)} />
                </div>
              </div>

              {/* Consumo / engajamento */}
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground">Consumo & atividade</p>
                {row.horasPeriodo === null && row.sessionsCount === null ? (
                  <p className="text-xs text-muted-foreground">Sem dados de engajamento para este aluno.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Horas no período</p>
                      <MetricValue size="md">
                        {row.horasPeriodo !== null ? `${row.horasPeriodo.toFixed(0)}h` : '—'}
                      </MetricValue>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sessões</p>
                      <MetricValue size="md">
                        {row.sessionsCount !== null ? row.sessionsCount : '—'}
                      </MetricValue>
                    </div>
                  </div>
                )}
              </div>

              {/* Evolução TRI */}
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground">Evolução TRI</p>
                {!hasGrowth || !growth ? (
                  <p className="text-xs text-muted-foreground">Sem histórico de evolução suficiente.</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums text-sm text-foreground">
                      {usesTheta
                        ? `${(growth.first_theta as number).toFixed(0)} → ${(growth.last_theta as number).toFixed(0)}`
                        : `${(growth.first_score_enamed as number).toFixed(0)} → ${(growth.last_score_enamed as number).toFixed(0)}`}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 font-mono tabular-nums text-sm font-medium',
                        deltaColorClass(usesTheta ? growth.delta_theta : growth.delta_score_enamed),
                      )}
                    >
                      <DeltaIcon delta={usesTheta ? growth.delta_theta : growth.delta_score_enamed} />
                      {usesTheta
                        ? (growth.delta_theta !== null ? growth.delta_theta.toFixed(0) : '—')
                        : (growth.delta_score_enamed !== null ? growth.delta_score_enamed.toFixed(0) : '—')}
                    </span>
                  </div>
                )}
              </div>

              {/* Próximos passos */}
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground">Próximos passos</p>
                <ul className="space-y-1.5">
                  {proximosPassos(row).map((passo) => (
                    <li key={passo} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      {passo}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
