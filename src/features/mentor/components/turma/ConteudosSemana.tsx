import * as React from 'react';
import type { AlunoTurma } from '@/services/mentor/turma';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  NOTA_SEM_CONSUMO_B2C,
  SEM_DADO,
  TOOLTIP_SEM_CONSUMO,
  descreverConteudos,
  formatMedia,
  resumoConsumoTurma,
  totalConteudos7d,
} from './consumo';

/** Célula "Conteúdos (7d)": total com tooltip "N vídeos · M documentos"; "–" com tooltip quando sem dado. */
export const CelulaConteudos7d: React.FC<{ aluno: AlunoTurma }> = ({ aluno }) => {
  const total = totalConteudos7d(aluno);
  const semDado = total === null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            data-testid="conteudos-7d"
            className={semDado ? 'cursor-help text-muted-foreground' : 'cursor-help'}
          >
            {semDado ? SEM_DADO : total}
          </span>
        </TooltipTrigger>
        <TooltipContent>{semDado ? TOOLTIP_SEM_CONSUMO : descreverConteudos(aluno.conteudos_7d)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Card "Conteúdos na semana": média de conteúdos (7d) por aluno COM dado de consumo.
 * Sem nenhum aluno com dado mostra "–" e a nota B2C.
 */
export const CardConteudosSemana: React.FC<{ alunos: AlunoTurma[] }> = ({ alunos }) => {
  const { comDado, media } = resumoConsumoTurma(alunos);
  return (
    <div className="space-y-1 rounded-xl border bg-card p-4" data-testid="card-conteudos">
      <p className="text-sm text-muted-foreground">Conteúdos na semana</p>
      <p className="text-3xl font-semibold" data-testid="card-conteudos-valor">
        {media === null ? SEM_DADO : formatMedia(media)}
      </p>
      {media === null ? (
        <p className="text-xs text-muted-foreground">{NOTA_SEM_CONSUMO_B2C}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          vídeos e documentos · {comDado} {comDado === 1 ? 'aluno com dado' : 'alunos com dado'}
        </p>
      )}
    </div>
  );
};
