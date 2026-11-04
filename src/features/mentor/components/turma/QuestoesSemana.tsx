import * as React from 'react';
import type { AlunoTurma } from '@/services/mentor/turma';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPct } from '../detalhamento/util';
import { formatMedia, SEM_DADO } from './consumo';
import { NOTA_SEM_QUESTOES_B2C, TOOLTIP_SEM_QUESTOES, descreverQuestoes, resumoQuestoesTurma, totalQuestoes7d } from './questoes';

export const CelulaQuestoes7d: React.FC<{ aluno: AlunoTurma }> = ({ aluno }) => {
  const total = totalQuestoes7d(aluno);
  const semDado = total === null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} data-testid="questoes-7d" className={semDado ? 'cursor-help text-muted-foreground' : 'cursor-help'}>
            {semDado ? SEM_DADO : total.toLocaleString('pt-BR')}
          </span>
        </TooltipTrigger>
        <TooltipContent>{semDado ? TOOLTIP_SEM_QUESTOES : descreverQuestoes(aluno.questoes_7d)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const CardQuestoesSemana: React.FC<{ alunos: AlunoTurma[] }> = ({ alunos }) => {
  const { comDado, media, pctAcerto } = resumoQuestoesTurma(alunos);
  return (
    <div className="space-y-1 rounded-xl border bg-card p-4" data-testid="card-questoes">
      <p className="text-sm text-muted-foreground">Questões na semana</p>
      <p className="text-3xl font-semibold" data-testid="card-questoes-valor">{media === null ? SEM_DADO : formatMedia(media)}</p>
      <p className="text-xs text-muted-foreground">
        {media === null ? NOTA_SEM_QUESTOES_B2C : <>
          {pctAcerto !== null && `${formatPct(pctAcerto)} de acerto · `}
          {comDado.toLocaleString('pt-BR')} {comDado === 1 ? 'aluno com dado' : 'alunos com dado'}
        </>}
      </p>
    </div>
  );
};
