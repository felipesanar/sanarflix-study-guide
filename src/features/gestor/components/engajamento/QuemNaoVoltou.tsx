import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  LinhaTabela,
  LinhasSkeleton,
  TabelaGestor,
} from '@/features/gestor/components/tabela';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { useEngajamentoLista, type FiltrosRecorteEngajamento } from '@/features/gestor/api/engajamento';
import type { FaixaRecencia, LinhaRecencia, VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { rotuloPeriodoMinusculo, textoDetalhe } from '@/features/gestor/lib/engajamento';
import { formatNumero, TRACO } from '@/features/gestor/lib/formatters';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';
import { ListaAlunosDialog } from './ListaAlunosDialog';

export interface QuemNaoVoltouProps {
  dados: VisaoGeralEngajamento | undefined;
  consulta: ConsultaDoBloco;
  filtros: FiltrosRecorteEngajamento & { periodo: string };
  /** "Filtrar na tabela de alunos": liga o filtro de 14 dias da tabela e rola até `#consumo`. */
  onFiltrarTabela: () => void;
}

/** Linhas da prévia. */
const TAMANHO_PREVIA = 5;

interface Faixa {
  id: FaixaRecencia;
  nome: string;
  /** Cor do segmento (§13). */
  cor: string;
}

/** Ordem fixa da barra e da legenda. "Nunca acessaram" sem "no período" (D7). */
const FAIXAS: Faixa[] = [
  { id: 'ativos30', nome: 'Ativos nos últimos 30 dias', cor: 'var(--gp-brand)' },
  { id: 'sumidos30a59', nome: 'Sumidos há 30–59 dias', cor: 'color-mix(in srgb, var(--gp-brand) 70%, var(--gp-surface-1))' },
  { id: 'sumidos60', nome: 'Sumidos há 60+ dias', cor: 'color-mix(in srgb, var(--gp-brand) 45%, var(--gp-surface-1))' },
  { id: 'nunca_acessou', nome: 'Nunca acessaram', cor: 'var(--gp-border-input)' },
];

const TITULO_PADRAO = 'Alunos sumidos há 30+ dias';

function contagem(dados: VisaoGeralEngajamento, id: FaixaRecencia): number {
  const r = dados.recencia;
  return id === 'ativos30' ? r.ativos30 : id === 'sumidos30a59' ? r.sumidos30a59 : id === 'sumidos60' ? r.sumidos60 : r.nuncaAcessou;
}

interface TabelaPreviaProps {
  linhas: Array<Pick<LinhaRecencia, 'id' | 'nome' | 'semestre' | 'diasSemAtividade' | 'detalhe'>>;
  rotulo: string;
}

function TabelaPrevia({ linhas, rotulo }: TabelaPreviaProps) {
  return (
    <TabelaGestor rotulo={rotulo}>
      <CabecalhoTabela>
        <tr>
          <CelulaCabecalho>Aluno</CelulaCabecalho>
          <CelulaCabecalho>Sem.</CelulaCabecalho>
          <CelulaCabecalho>Última atividade</CelulaCabecalho>
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
              <Celula>{textoDetalhe(l.detalhe)}</Celula>
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
  faixa,
  titulo,
  aoCarregar,
}: {
  filtros: FiltrosRecorteEngajamento;
  faixa: FaixaRecencia;
  titulo: string;
  aoCarregar: (info: { total: number; linhas: number } | null) => void;
}) {
  const consulta = useEngajamentoLista(filtros, faixa, '', 1, TAMANHO_PREVIA);
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
 * "Quem não voltou" (spec §4.1, §12.2): a base ativa repartida pelo tempo desde a
 * última atividade, numa barra empilhada cujos segmentos são botões. Sem faixa
 * selecionada, a prévia lista os 5 sumidos há mais tempo; com faixa, os 5
 * primeiros dela. "Ver lista completa" abre o pop-up quando há mais de 5.
 */
export function QuemNaoVoltou({ dados, consulta, filtros, onFiltrarTabela }: QuemNaoVoltouProps) {
  const [faixa, setFaixa] = React.useState<FaixaRecencia | null>(null);
  const [infoFaixa, setInfoFaixa] = React.useState<{ total: number; linhas: number } | null>(null);
  const [listaAberta, setListaAberta] = React.useState(false);

  const base = dados?.kpis.baseAtiva ?? 0;
  const faixaAtual = FAIXAS.find((f) => f.id === faixa) ?? null;
  const titulo = faixaAtual ? faixaAtual.nome : TITULO_PADRAO;
  const alternar = (id: FaixaRecencia) => setFaixa((atual) => (atual === id ? null : id));

  const previa = dados?.recencia.previaSumidos30mais ?? [];
  const total = faixa
    ? (infoFaixa?.total ?? null)
    : dados
      ? dados.recencia.sumidos30a59 + dados.recencia.sumidos60
      : null;
  const mostrados = faixa ? (infoFaixa?.linhas ?? 0) : Math.min(TAMANHO_PREVIA, previa.length);

  return (
    <BlocoEngajamento
      titulo="Quem não voltou"
      descricao="Base ativa pelo tempo desde a última atividade"
      acao={
        <button
          type="button"
          onClick={onFiltrarTabela}
          className="text-[color:var(--gp-brand-strong)] underline-offset-2 hover:underline dark:text-[color:var(--gp-brand-on-dark)]"
          style={{ fontSize: 'var(--gp-font-size-apoio)', fontWeight: 'var(--gp-font-weight-medio)' }}
        >
          Filtrar na tabela de alunos
        </button>
      }
      consulta={consulta}
      alturaSkeleton={360}
      bloco="quem-nao-voltou"
    >
      {dados ? (
        <>
          <div
            role="group"
            aria-label="Distribuição da base pelo tempo desde a última atividade · clique numa faixa para listar os alunos"
            className="flex w-full overflow-hidden"
            style={{ height: 28, borderRadius: 'var(--gp-radius-sm)', background: 'var(--gp-surface-3)' }}
          >
            {FAIXAS.map((f) => {
              const n = contagem(dados, f.id);
              if (n === 0 || base === 0) return null;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={faixa === f.id}
                  aria-label={`${f.nome}: ${formatNumero(n)} alunos`}
                  data-testid={`segmento-${f.id}`}
                  onClick={() => alternar(f.id)}
                  style={{
                    width: `${(100 * n) / base}%`,
                    background: f.cor,
                    outline: faixa === f.id ? '2px solid var(--gp-text-1)' : undefined,
                    outlineOffset: -2,
                  }}
                />
              );
            })}
          </div>

          <ul className="m-0 flex list-none flex-wrap p-0" style={{ gap: 16, fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-2)' }}>
            {FAIXAS.map((f) => (
              <li key={f.id} className="inline-flex items-center" style={{ gap: 6 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: f.cor }} />
                {f.nome}
                <strong className="tabular-nums" style={{ color: 'var(--gp-text-1)' }}>
                  {formatNumero(contagem(dados, f.id))}
                </strong>
              </li>
            ))}
          </ul>

          <div className="flex flex-col" style={{ gap: 8 }}>
            <h3 style={{ fontSize: 'var(--gp-font-size-h3)', fontWeight: 'var(--gp-font-weight-forte)' }}>{titulo}</h3>
            {faixa ? (
              <PreviaDaFaixa filtros={filtros} faixa={faixa} titulo={titulo} aoCarregar={setInfoFaixa} />
            ) : (
              <TabelaPrevia linhas={previa.slice(0, TAMANHO_PREVIA)} rotulo={titulo} />
            )}
            {total !== null && total > TAMANHO_PREVIA ? (
              <div className="flex flex-wrap items-center" style={{ gap: 12, fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>
                <span>
                  Mostrando {formatNumero(mostrados)} de {formatNumero(total)} alunos
                </span>
                <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setListaAberta(true)}>
                  Ver lista completa
                </Button>
              </div>
            ) : null}
          </div>

          {listaAberta ? (
            <ListaAlunosDialog
              categoria={faixa ?? 'sumidos30mais'}
              titulo={titulo}
              colunaDetalhe="ultima"
              filtros={filtros}
              iesNome={dados.ies.nome}
              periodoRotulo={rotuloPeriodoMinusculo(filtros.periodo, dados.periodo.hoje)}
              alunoNome={dados.recorte.aluno?.nome ?? null}
              onFechar={() => setListaAberta(false)}
            />
          ) : null}
        </>
      ) : null}
    </BlocoEngajamento>
  );
}
