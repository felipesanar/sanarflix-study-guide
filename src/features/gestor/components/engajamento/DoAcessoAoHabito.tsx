import * as React from 'react';
import { Button } from '@/components/ui/button';
import { formatNumero, TRACO } from '@/features/gestor/lib/formatters';
import { mesAno, pct1, primeiroNome, rotuloPeriodoMinusculo } from '@/features/gestor/lib/engajamento';
import { useEngajamentoLista, type FiltrosRecorteEngajamento } from '@/features/gestor/api/engajamento';
import type { FaixaHabito, LinhaListaEngajamento, VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  LinhaTabela,
  LinhasSkeleton,
  TabelaGestor,
} from '@/features/gestor/components/tabela';
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

/** Linhas da prévia, como em "Quem não voltou". */
const TAMANHO_PREVIA = 5;

function TabelaPrevia({ linhas, rotulo }: { linhas: LinhaListaEngajamento[]; rotulo: string }) {
  return (
    <TabelaGestor rotulo={rotulo}>
      <CabecalhoTabela>
        <tr>
          <CelulaCabecalho>Aluno</CelulaCabecalho>
          <CelulaCabecalho>Sem.</CelulaCabecalho>
          <CelulaCabecalho numerica>Dias ativos no mês</CelulaCabecalho>
          <CelulaCabecalho numerica>Dias sem consumo</CelulaCabecalho>
        </tr>
      </CabecalhoTabela>
      <CorpoTabela>
        {linhas.length === 0 ? (
          <tr>
            <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--gp-text-3)', fontSize: 'var(--gp-font-size-body)' }}>
              Nenhum aluno nesta faixa neste recorte.
            </td>
          </tr>
        ) : (
          linhas.map((l, i) => (
            <LinhaTabela key={l.id} ultima={i === linhas.length - 1}>
              <Celula>{l.nome}</Celula>
              <Celula>{l.semestre}º</Celula>
              <Celula numerica>{formatNumero(l.diasAtivosMes)}</Celula>
              <Celula numerica ausente={l.diasSemAtividade === null}>
                {l.diasSemAtividade === null ? TRACO : formatNumero(l.diasSemAtividade)}
              </Celula>
            </LinhaTabela>
          ))
        )}
      </CorpoTabela>
    </TabelaGestor>
  );
}

/** Prévia de uma faixa clicada: 5 alunos pela RPC de lista. Só existe com faixa, então a consulta só roda então. */
function PreviaDaFaixa({
  filtros,
  categoria,
  titulo,
  aoCarregar,
}: {
  filtros: FiltrosRecorteEngajamento;
  categoria: FaixaHabito;
  titulo: string;
  aoCarregar: (info: { total: number; linhas: number } | null) => void;
}) {
  const consulta = useEngajamentoLista(filtros, categoria, '', 1, TAMANHO_PREVIA);
  const total = consulta.data?.total ?? null;
  const linhas = consulta.data?.data.length ?? 0;
  React.useEffect(() => {
    aoCarregar(total === null ? null : { total, linhas });
  }, [total, linhas, aoCarregar]);

  if (consulta.isError && !consulta.data) return <EstadoErro altura={160} onRetry={consulta.refetch} />;
  if (!consulta.data) {
    return (
      <TabelaGestor rotulo={titulo}>
        <CorpoTabela>
          <LinhasSkeleton colunas={4} linhas={TAMANHO_PREVIA} />
        </CorpoTabela>
      </TabelaGestor>
    );
  }
  return <TabelaPrevia linhas={consulta.data.data} rotulo={titulo} />;
}

/**
 * "Do acesso ao hábito" (spec §4.3, §12.2): a base ativa e, abaixo, quantos
 * alunos ficaram em cada faixa de dias ativos no último mês fechado. A barra de
 * cada linha é a fração da BASE ATIVA (a primeira é 100%); o texto "· x,x% dos
 * ativos no mês" é a fração de quem teve atividade no mês (as quatro faixas somam
 * `ativosNoMes`).
 *
 * Clicar numa das quatro faixas lista os alunos dela, como "Quem não voltou": prévia
 * de 5 embaixo e "Ver lista completa" quando há mais. Clicar de novo fecha.
 *
 * Com aluno filtrado, cada faixa vira "Sim"/"Não" (a RPC devolve 1 ou 0 em cada
 * contagem) e a barra fica cheia só na faixa dele; as faixas não são clicáveis
 * (a lista teria, no máximo, ele mesmo).
 */
export function DoAcessoAoHabito({ dados, consulta, filtros }: DoAcessoAoHabitoProps) {
  const [faixa, setFaixa] = React.useState<ChaveFaixa | null>(null);
  const [infoFaixa, setInfoFaixa] = React.useState<{ total: number; linhas: number } | null>(null);
  const [listaAberta, setListaAberta] = React.useState(false);

  const habito = dados?.habito;
  const baseAtiva = dados?.kpis.baseAtiva ?? 0;
  const alunoRecorte = dados?.aluno ? dados.recorte.aluno : null;
  const filtrosLista = filtros && !alunoRecorte ? filtros : null;
  const faixaAtual = filtrosLista ? (LINHAS.find((l) => l.chave === faixa) ?? null) : null;
  const alternar = (chave: ChaveFaixa) => {
    setInfoFaixa(null);
    setFaixa((atual) => (atual === chave ? null : chave));
  };

  const descricao = !habito
    ? undefined
    : alunoRecorte
      ? `Em que faixa ${primeiroNome(alunoRecorte.nome)} ficou em ${mesAno(habito.mes)} · ${formatNumero(habito.diasAtivosAluno ?? 0)} dias ativos no mês`
      : `Dias ativos em ${mesAno(habito.mes)} (último mês fechado) · ${formatNumero(habito.ativosNoMes)} dos ${formatNumero(baseAtiva)} alunos tiveram atividade no mês`;

  const categoria = faixa ? CATEGORIA_DA_FAIXA[faixa] : null;
  const tituloLista = faixaAtual ? `Alunos: ${faixaAtual.nome.toLowerCase()}` : '';
  const totalFaixa = faixa && habito ? (infoFaixa?.total ?? habito[faixa]) : null;

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
              const selecionada = chaveFaixa !== null && faixa === chaveFaixa;
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
                  <div style={{ marginTop: 6 }}>
                    <BarraHorizontal pct={pctBarra} cor={linha.cor} />
                  </div>
                </>
              );
              return (
                <li key={linha.chave} data-testid={`habito-${linha.chave}`}>
                  {filtrosLista && chaveFaixa !== null ? (
                    <button
                      type="button"
                      aria-pressed={selecionada}
                      aria-label={`${linha.nome}: ${formatNumero(n)} alunos · clique para listar`}
                      data-testid={`habito-faixa-${linha.chave}`}
                      onClick={() => alternar(chaveFaixa)}
                      className="block cursor-pointer"
                      style={{
                        padding: '6px 8px',
                        margin: '-6px -8px',
                        width: 'calc(100% + 16px)',
                        borderRadius: 'var(--gp-radius-sm)',
                        background: selecionada ? 'var(--gp-brand-surface-soft)' : undefined,
                        outline: selecionada ? '2px solid var(--gp-brand-border)' : undefined,
                        outlineOffset: -2,
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

      {dados && filtrosLista && categoria && faixaAtual ? (
        <div className="flex flex-col" style={{ gap: 8 }} data-testid="habito-lista">
          <h3 style={{ fontSize: 'var(--gp-font-size-h3)', fontWeight: 'var(--gp-font-weight-forte)' }}>{tituloLista}</h3>
          <PreviaDaFaixa filtros={filtrosLista} categoria={categoria} titulo={tituloLista} aoCarregar={setInfoFaixa} />
          {totalFaixa !== null && totalFaixa > TAMANHO_PREVIA ? (
            <div className="flex flex-wrap items-center" style={{ gap: 12, fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>
              <span>
                Mostrando {formatNumero(Math.min(TAMANHO_PREVIA, infoFaixa?.linhas ?? TAMANHO_PREVIA))} de {formatNumero(totalFaixa)} alunos
              </span>
              <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setListaAberta(true)}>
                Ver lista completa
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {dados && filtrosLista && categoria && faixaAtual && listaAberta ? (
        <ListaAlunosDialog
          categoria={categoria}
          titulo={tituloLista}
          regra={faixaAtual.descricao}
          colunaDetalhe="diasAtivosMes"
          filtros={filtrosLista}
          iesNome={dados.ies.nome}
          periodoRotulo={rotuloPeriodoMinusculo(filtrosLista.periodo, dados.periodo.hoje)}
          alunoNome={dados.recorte.aluno?.nome ?? null}
          onFechar={() => setListaAberta(false)}
        />
      ) : null}
    </BlocoEngajamento>
  );
}
