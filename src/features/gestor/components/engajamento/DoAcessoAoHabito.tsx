import * as React from 'react';
import { formatNumero } from '@/features/gestor/lib/formatters';
import { mesAno, pct1, primeiroNome, rotuloPeriodoMinusculo } from '@/features/gestor/lib/engajamento';
import type { FiltrosRecorteEngajamento } from '@/features/gestor/api/engajamento';
import type { FaixaHabito, VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { Icon } from '@/features/gestor/components/Icon';
import { BarraHorizontal } from './BarraHorizontal';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';
import { ListaAlunosDialog } from './ListaAlunosDialog';

export interface DoAcessoAoHabitoProps {
  dados: VisaoGeralEngajamento | undefined;
  consulta: ConsultaDoBloco;
  /** Filtros da página: a lista de cada faixa respeita semestre e aluno, como as contagens. Sem eles as faixas não são clicáveis. */
  filtros?: FiltrosRecorteEngajamento & { periodo: string };
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

type ChaveFaixa = Exclude<LinhaHabito['chave'], 'base'>;
const CATEGORIA_DA_FAIXA: Record<ChaveFaixa, FaixaHabito> = {
  baixo: 'habito_baixo',
  medio: 'habito_medio',
  alto: 'habito_alto',
  altissimo: 'habito_altissimo',
};

/**
 * "Do acesso ao hábito" (spec §4.3, §12.2): a base ativa e, abaixo, quantos
 * alunos ficaram em cada faixa de dias ativos no último mês fechado. A barra de
 * cada linha é a fração da BASE ATIVA (a primeira é 100%); o texto "· x,x% dos
 * ativos no mês" é a fração de quem teve atividade no mês (as quatro faixas somam
 * `ativosNoMes`).
 *
 * Clicar numa das quatro faixas abre um pop-up com os alunos dela (Aluno, Sem.,
 * Dias ativos no mês, Dias sem consumo). O bloco não muda de tamanho. Cada faixa
 * traz "Ver alunos ›" para deixar claro que dá para clicar.
 *
 * Com aluno filtrado, cada faixa vira "Sim"/"Não" (a RPC devolve 1 ou 0 em cada
 * contagem) e a barra fica cheia só na faixa dele; as faixas não são clicáveis
 * (a lista teria, no máximo, ele mesmo).
 */
export function DoAcessoAoHabito({ dados, consulta, filtros }: DoAcessoAoHabitoProps) {
  const [faixaAberta, setFaixaAberta] = React.useState<ChaveFaixa | null>(null);

  const habito = dados?.habito;
  const baseAtiva = dados?.kpis.baseAtiva ?? 0;
  const alunoRecorte = dados?.aluno ? dados.recorte.aluno : null;
  const filtrosLista = filtros && !alunoRecorte ? filtros : null;
  const linhaAberta = filtrosLista ? (LINHAS.find((l) => l.chave === faixaAberta) ?? null) : null;

  const descricao = !habito
    ? undefined
    : alunoRecorte
      ? `Em que faixa ${primeiroNome(alunoRecorte.nome)} ficou em ${mesAno(habito.mes)} · ${formatNumero(habito.diasAtivosAluno ?? 0)} dias ativos no mês`
      : `Dias ativos em ${mesAno(habito.mes)} (último mês fechado) · ${formatNumero(habito.ativosNoMes)} dos ${formatNumero(baseAtiva)} alunos tiveram atividade no mês`;

  return (
    <BlocoEngajamento
      titulo="Do acesso ao hábito"
      descricao={descricao}
      consulta={consulta}
      alturaSkeleton={300}
      bloco="do-acesso-ao-habito"
      preencherAltura
    >
      <ul className="m-0 flex list-none flex-col p-0" style={{ gap: 14 }}>
        {habito
          ? LINHAS.map((linha) => {
              const n = linha.chave === 'base' ? baseAtiva : habito[linha.chave];
              const dentro = linha.chave === 'base' || n > 0;
              const pctBarra = alunoRecorte ? (dentro ? 100 : 0) : baseAtiva > 0 ? (100 * n) / baseAtiva : 0;
              const chaveFaixa = linha.chave === 'base' ? null : linha.chave;
              const clicavel = filtrosLista !== null && chaveFaixa !== null;
              const conteudo = (
                <>
                  <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 8 }}>
                    <div className="min-w-0 text-left">
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
                  <div className="flex items-center" style={{ marginTop: 6, gap: 12 }}>
                    <div className="min-w-0 flex-1">
                      <BarraHorizontal pct={pctBarra} cor={linha.cor} />
                    </div>
                    {clicavel ? (
                      <span
                        aria-hidden="true"
                        data-testid="habito-dica-clique"
                        className="inline-flex shrink-0 items-center text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]"
                        style={{ gap: 2, fontSize: 'var(--gp-font-size-apoio)', fontWeight: 'var(--gp-font-weight-medio)' }}
                      >
                        Ver alunos
                        <Icon name="chevron_right" size={16} />
                      </span>
                    ) : null}
                  </div>
                </>
              );
              return (
                <li key={linha.chave} data-testid={`habito-${linha.chave}`}>
                  {clicavel ? (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-label={`${linha.nome}: ${formatNumero(n)} alunos · ver lista de alunos`}
                      data-testid={`habito-faixa-${linha.chave}`}
                      onClick={() => setFaixaAberta(chaveFaixa)}
                      className="block cursor-pointer transition-colors hover:bg-[color:var(--gp-brand-surface-soft)]"
                      style={{
                        padding: '6px 8px',
                        margin: '-6px -8px',
                        width: 'calc(100% + 16px)',
                        borderRadius: 'var(--gp-radius-sm)',
                      }}
                    >
                      {conteudo}
                    </button>
                  ) : (
                    conteudo
                  )}
                </li>
              );
            })
          : null}
      </ul>

      {dados && filtrosLista && faixaAberta && linhaAberta ? (
        <ListaAlunosDialog
          categoria={CATEGORIA_DA_FAIXA[faixaAberta]}
          titulo={`Alunos: ${linhaAberta.nome.toLowerCase()}`}
          regra={linhaAberta.descricao}
          colunaDetalhe="diasAtivosMes"
          filtros={filtrosLista}
          iesNome={dados.ies.nome}
          periodoRotulo={rotuloPeriodoMinusculo(filtrosLista.periodo, dados.periodo.hoje)}
          alunoNome={dados.recorte.aluno?.nome ?? null}
          onFechar={() => setFaixaAberta(null)}
        />
      ) : null}
    </BlocoEngajamento>
  );
}
