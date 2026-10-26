import * as React from 'react';
import { formatNumero } from '@/features/gestor/lib/formatters';
import { mesAno, pct1, primeiroNome } from '@/features/gestor/lib/engajamento';
import type { VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { BarraHorizontal } from './BarraHorizontal';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';

export interface DoAcessoAoHabitoProps {
  dados: VisaoGeralEngajamento | undefined;
  consulta: ConsultaDoBloco;
}

interface LinhaHabito {
  chave: 'base' | 'baixo' | 'medio' | 'alto' | 'altissimo';
  nome: string;
  descricao: string;
  /** Cor da barra (§13). */
  cor: string;
}

const LINHAS: LinhaHabito[] = [
  { chave: 'base', nome: 'Base ativa', descricao: 'Alunos com acesso vigente no SanarFlix', cor: 'var(--gp-border-input)' },
  {
    chave: 'baixo',
    nome: 'Baixo engajamento',
    descricao: '1 a 3 dias ativos no mês',
    cor: 'color-mix(in srgb, var(--gp-brand) 30%, var(--gp-surface-1))',
  },
  {
    chave: 'medio',
    nome: 'Médio engajamento',
    descricao: '4 a 7 dias ativos no mês',
    cor: 'color-mix(in srgb, var(--gp-brand) 45%, var(--gp-surface-1))',
  },
  {
    chave: 'alto',
    nome: 'Alto engajamento',
    descricao: '8 a 14 dias ativos no mês',
    cor: 'color-mix(in srgb, var(--gp-brand) 70%, var(--gp-surface-1))',
  },
  { chave: 'altissimo', nome: 'Altíssimo engajamento', descricao: '15 dias ou mais ativos no mês', cor: 'var(--gp-brand-strong)' },
];

/**
 * "Do acesso ao hábito" (spec §4.3, §12.2): a base ativa e, abaixo, quantos
 * alunos ficaram em cada faixa de dias ativos no último mês fechado. A barra de
 * cada linha é a fração da BASE ATIVA (a primeira é 100%); o texto "· x,x% dos
 * ativos no mês" é a fração de quem teve atividade no mês (as quatro faixas somam
 * `ativosNoMes`).
 *
 * Com aluno filtrado, cada faixa vira "Sim"/"Não" (a RPC devolve 1 ou 0 em cada
 * contagem) e a barra fica cheia só na faixa dele.
 */
export function DoAcessoAoHabito({ dados, consulta }: DoAcessoAoHabitoProps) {
  const habito = dados?.habito;
  const baseAtiva = dados?.kpis.baseAtiva ?? 0;
  const alunoRecorte = dados?.aluno ? dados.recorte.aluno : null;

  const descricao = !habito
    ? undefined
    : alunoRecorte
      ? `Em que faixa ${primeiroNome(alunoRecorte.nome)} ficou em ${mesAno(habito.mes)} · ${formatNumero(habito.diasAtivosAluno ?? 0)} dias ativos no mês`
      : `Dias ativos em ${mesAno(habito.mes)} (último mês fechado) · ${formatNumero(habito.ativosNoMes)} dos ${formatNumero(baseAtiva)} alunos tiveram atividade no mês`;

  return (
    <BlocoEngajamento titulo="Do acesso ao hábito" descricao={descricao} consulta={consulta} alturaSkeleton={300} bloco="do-acesso-ao-habito">
      <ul className="m-0 flex list-none flex-col p-0" style={{ gap: 14 }}>
        {habito
          ? LINHAS.map((linha) => {
              const n = linha.chave === 'base' ? baseAtiva : habito[linha.chave];
              const dentro = linha.chave === 'base' || n > 0;
              const pctBarra = alunoRecorte ? (dentro ? 100 : 0) : baseAtiva > 0 ? (100 * n) / baseAtiva : 0;
              return (
                <li key={linha.chave} data-testid={`habito-${linha.chave}`}>
                  <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 8 }}>
                    <div className="min-w-0">
                      <div style={{ fontSize: 'var(--gp-font-size-body)', fontWeight: 'var(--gp-font-weight-medio)', color: 'var(--gp-text-1)' }}>
                        {linha.nome}
                      </div>
                      <div style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>{linha.descricao}</div>
                    </div>
                    <div className="tabular-nums" style={{ fontSize: 'var(--gp-font-size-body)', color: 'var(--gp-text-1)' }}>
                      {alunoRecorte ? (
                        <strong data-testid="habito-valor">{dentro ? 'Sim' : 'Não'}</strong>
                      ) : (
                        <>
                          <strong data-testid="habito-valor">{formatNumero(n)}</strong>
                          <span style={{ marginLeft: 6, fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>
                            {linha.chave === 'base'
                              ? '· 100%'
                              : `· ${pct1(habito.ativosNoMes > 0 ? (100 * n) / habito.ativosNoMes : null)} dos ativos no mês`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <BarraHorizontal pct={pctBarra} cor={linha.cor} />
                  </div>
                </li>
              );
            })
          : null}
      </ul>
    </BlocoEngajamento>
  );
}
