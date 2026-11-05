import * as React from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Tag } from '@/features/gestor/components/Tag';
import {
  TabelaAlunosSimulado,
  type ColunaAlunoSimulado,
  type FaixaAlunoSimulado,
} from '@/features/gestor/components/TabelaAlunosSimulado';
import { TRACO, formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import type { AlunoVisaoB2b, AlunoVisaoB2c, FaixaB2b, SituacaoMetaLinha } from './derivar';

const SUCESSO = { color: 'var(--gp-success-on)', background: 'var(--gp-success-surface)' };
const ALERTA = { color: 'var(--gp-warning-on)', background: 'var(--gp-warning-surface)' };
const PERIGO = { color: 'var(--gp-danger-on)', background: 'var(--gp-danger-surface)' };

const SITUACAO_B2C: Record<SituacaoMetaLinha, { rotulo: string; par?: React.CSSProperties }> = {
  acima: { rotulo: 'Acima do corte', par: SUCESSO },
  proximo: { rotulo: 'Próximo do corte', par: ALERTA },
  longe: { rotulo: 'Longe do corte', par: PERIGO },
  // Metas é V1: sem corte conhecido o aluno não entra em nenhuma aba (docs/02 § Estados).
  sem_meta: { rotulo: 'Aguardando Metas' },
};
const SITUACAO_B2B: Record<FaixaB2b, { rotulo: string; par: React.CSSProperties }> = {
  proficiente: { rotulo: 'Proficiente', par: SUCESSO },
  virada: { rotulo: 'Potencial de virada', par: ALERTA },
  abaixo: { rotulo: 'Abaixo do limiar', par: PERIGO },
};

function TagSituacao({ rotulo, par }: { rotulo: string; par?: React.CSSProperties }) {
  return par ? <Tag variant="positivo" style={par}>{rotulo}</Tag> : <Tag variant="ausencia">{rotulo}</Tag>;
}
const NAO_PARTICIPOU = <Tag variant="ausencia">Não participou</Tag>;

const COLUNAS_B2C: ColunaAlunoSimulado<AlunoVisaoB2c>[] = [
  { id: 'ultimo-acesso', rotulo: 'Último acesso', valor: (a) => a.ultimoAcesso, ausente: (a) => a.ultimoAcesso === TRACO },
  { id: 'acertos', rotulo: 'Acertos', numerica: true, valor: (a) => formatNumero(a.acertos), ausente: (a) => a.acertos === null, ordenarPor: (a) => a.acertos },
  { id: 'acerto-pct', rotulo: '% de acerto', numerica: true, valor: (a) => formatPct(a.acertoPct), ausente: (a) => a.acertoPct === null, ordenarPor: (a) => a.acertoPct },
  { id: 'corte', rotulo: 'Corte da meta', numerica: true, valor: (a) => formatPct(a.corte), ausente: (a) => a.corte === null, ordenarPor: (a) => a.corte },
  { id: 'situacao', rotulo: 'Situação', valor: (a) => (a.situacaoMeta ? <TagSituacao {...SITUACAO_B2C[a.situacaoMeta]} /> : NAO_PARTICIPOU) },
];
const FAIXAS_B2C: FaixaAlunoSimulado<AlunoVisaoB2c>[] = [
  { chave: 'acima', rotulo: 'Acima do corte', cor: 'var(--gp-success)', contem: (a) => a.situacaoMeta === 'acima' },
  { chave: 'proximo', rotulo: 'Próximo do corte', cor: 'var(--gp-warning)', contem: (a) => a.situacaoMeta === 'proximo' },
  { chave: 'longe', rotulo: 'Longe do corte', cor: 'var(--gp-danger)', contem: (a) => a.situacaoMeta === 'longe' },
];

const COLUNAS_B2B: ColunaAlunoSimulado<AlunoVisaoB2b>[] = [
  { id: 'semestre', rotulo: 'Semestre', numerica: true, valor: (a) => (a.semestre === null ? TRACO : `${a.semestre}º`), ausente: (a) => a.semestre === null, ordenarPor: (a) => a.semestre },
  { id: 'acerto-pct', rotulo: '% de acerto', numerica: true, valor: (a) => formatPct(a.acertoPct), ausente: (a) => a.acertoPct === null, ordenarPor: (a) => a.acertoPct },
  { id: 'proficiencia', rotulo: 'Proficiência', numerica: true, valor: (a) => formatNumero(a.proficiencia), ausente: (a) => a.proficiencia === null, ordenarPor: (a) => a.proficiencia },
  { id: 'limiar', rotulo: 'Limiar', numerica: true, valor: () => String(PROFICIENCIA_MINIMA) },
  { id: 'situacao', rotulo: 'Situação', valor: (a) => (a.faixa ? <TagSituacao {...SITUACAO_B2B[a.faixa]} /> : NAO_PARTICIPOU) },
];
const FAIXAS_B2B: FaixaAlunoSimulado<AlunoVisaoB2b>[] = [
  { chave: 'proficiente', rotulo: 'Proficiente', cor: 'var(--gp-success)', contem: (a) => a.faixa === 'proficiente' },
  { chave: 'virada', rotulo: 'Potencial de virada', cor: 'var(--gp-warning)', contem: (a) => a.faixa === 'virada' },
  { chave: 'abaixo', rotulo: 'Abaixo do limiar', cor: 'var(--gp-danger)', contem: (a) => a.faixa === 'abaixo' },
];

interface Comum {
  estado: 'loading' | 'error' | 'ok';
  multiSimulado: boolean;
  onAbrirAluno: (email: string) => void;
  onTentarNovamente: () => void;
}
export type VisaoAlunosProps =
  | (Comum & { modalidade: 'b2c'; alunos: AlunoVisaoB2c[] })
  | (Comum & { modalidade: 'b2b'; alunos: AlunoVisaoB2b[] });

/**
 * Visão de alunos (docs/02 e 03 § Tela 3 · 6) sobre a `TabelaAlunosSimulado` do Gestor: B2C por corte da
 * meta com "Último acesso" (sem semestre); B2B com Proficiente / Potencial de virada / Abaixo do limiar.
 * Calculada no simulado mais recente do recorte; abre pelo clique o drawer do aluno (`?aluno=`).
 */
export function VisaoAlunos(p: VisaoAlunosProps) {
  if (p.estado === 'loading') {
    return (
      <div data-testid="visao-alunos-carregando" className="flex flex-col gap-2">
        <GestorSkeleton altura={36} rotulo="Carregando visão de alunos" />
        <GestorSkeleton altura={260} forma="cartao" rotulo="Carregando visão de alunos" />
      </div>
    );
  }
  if (p.estado === 'error') {
    return <EstadoErro titulo="Não foi possível carregar a visão de alunos." onRetry={p.onTentarNovamente} />;
  }
  const comum = {
    multiSimulado: p.multiSimulado,
    onSelecionarAluno: p.onAbrirAluno,
    rotuloFaixas: 'Filtrar alunos por situação',
    ocultarNaoParticipantesInicial: true,
  };
  return p.modalidade === 'b2c' ? (
    <TabelaAlunosSimulado
      {...comum}
      alunos={p.alunos}
      colunas={COLUNAS_B2C}
      faixas={FAIXAS_B2C}
      ordenacaoInicial={{ coluna: 'acerto-pct', ordem: 'desc' }}
    />
  ) : (
    <TabelaAlunosSimulado
      {...comum}
      alunos={p.alunos}
      colunas={COLUNAS_B2B}
      faixas={FAIXAS_B2B}
      ordenacaoInicial={{ coluna: 'proficiencia', ordem: 'desc' }}
    />
  );
}
