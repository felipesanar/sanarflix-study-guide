import * as React from 'react';
import { StatCard } from '@/experiences/admin/ui';
import { compacto } from '@/features/gestor/lib/engajamento';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import type { AdminEngajamento } from '@/features/gestor/api/types-engajamento';

export interface KpisRedeProps {
  rede: AdminEngajamento['rede'];
  /** Semestre filtrado (`sem`); muda o rótulo da base e as notas. */
  semestre: number | null;
}

/**
 * Os 4 KPIs da rede (spec §12.5). Sem semestre: base ativa, engajados (mediana por
 * IES), sem retorno e questões. Com semestre, a base leva o semestre no rótulo e
 * "Engajados" compara com a rede inteira. Cores do tema geral do console (nada de `--gp-*`).
 */
export function KpisRede({ rede, semestre }: KpisRedeProps) {
  const comSemestre = semestre !== null;

  return (
    <div data-testid="kpis-rede" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={comSemestre ? `Base ativa · ${semestre}º semestre` : 'Base ativa da rede'}
        value={formatNumero(rede.baseAtiva)}
        hint={`${formatNumero(rede.ies)} IES`}
      />
      <StatCard
        label="Engajados"
        value={formatPct(rede.engajadosPct)}
        hint={
          comSemestre
            ? `rede inteira: ${formatPct(rede.engajadosPctRede)}`
            : `mediana por IES: ${formatPct(rede.medianaEngajadosPctIes)}`
        }
      />
      <StatCard
        label="Sem retorno há 30+ dias"
        value={formatNumero(rede.semRetorno30)}
        accent="red"
        hint={`${formatPct(rede.semRetorno30Pct)} da base${comSemestre ? ' do semestre' : ''}`}
      />
      <StatCard
        label="Questões resolvidas"
        value={compacto(rede.questoes)}
        hint={`acerto médio ${formatPct(rede.acertoPct)}`}
      />
    </div>
  );
}
