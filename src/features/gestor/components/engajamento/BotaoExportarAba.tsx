import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '@/features/gestor/components/Icon';
import { ESTILO_CONTROLE } from '@/features/gestor/components/engajamento/FiltroPeriodo';
import { useEngajamentoConteudos, useEngajamentoQuestoes, useEngajamentoVisaoGeral } from '@/features/gestor/api/engajamento';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { baixarCsvSecoes, type SecaoCsv } from '@/features/gestor/lib/exportarCsv';
import {
  nomeArquivoExportacao,
  secoesConteudos,
  secoesQuestoes,
  secoesVisaoGeral,
  type AbaExportavel,
  type RecorteExportacao,
} from '@/features/gestor/lib/exportarEngajamento';

/**
 * Botão "Exportar" do cabeçalho (spec §12.1, D11/P16): CSV com os números
 * agregados da aba atual, sem dado pessoal e portanto sem depender de
 * `podeExportar`. Sem `onExportar` fica desabilitado (dados da aba ainda não chegaram).
 */
export function BotaoExportar({ onExportar }: { onExportar?: () => void }) {
  return (
    <button
      type="button"
      onClick={onExportar}
      disabled={!onExportar}
      className="inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ ...ESTILO_CONTROLE, fontWeight: 600 }}
    >
      <Icon name="download" size={16} />
      Exportar
    </button>
  );
}

export interface BotaoExportarAbaProps {
  filtros: FiltrosEngajamento;
  /** Nome da IES (vem da visão geral); sem ele o botão fica desabilitado. */
  iesNome?: string;
  /** Nome do aluno filtrado, quando há (só vale na Visão geral). */
  alunoNome?: string | null;
}

const BASE = '/gestor/engajamento';

function abaDe(pathname: string): AbaExportavel {
  const limpo = pathname.replace(/\/+$/, '');
  if (limpo === `${BASE}/questoes`) return 'questoes';
  if (limpo === `${BASE}/conteudos`) return 'conteudos';
  return 'visao-geral';
}

function baixar(aba: AbaExportavel, iesNome: string, secoes: SecaoCsv<unknown>[]) {
  baixarCsvSecoes(nomeArquivoExportacao(aba, iesNome), secoes);
}

/**
 * Cada aba lê a MESMA consulta que a própria tela usa (mesma chave de cache),
 * então o CSV sai dos números que estão na tela, sem outra ida ao servidor. Um
 * componente por aba porque só a aba atual pode consultar.
 */
function ExportarVisaoGeral({ filtros, iesNome, alunoNome }: BotaoExportarAbaProps) {
  const { data } = useEngajamentoVisaoGeral(filtros);
  const recorte: RecorteExportacao = { inicio: filtros.inicio, fim: filtros.fim, semestre: filtros.semestre, alunoNome };
  return (
    <BotaoExportar
      onExportar={data && iesNome ? () => baixar('visao-geral', iesNome, secoesVisaoGeral(data, recorte)) : undefined}
    />
  );
}

function ExportarQuestoes({ filtros, iesNome }: BotaoExportarAbaProps) {
  const { data } = useEngajamentoQuestoes(filtros);
  const recorte: RecorteExportacao = { inicio: filtros.inicio, fim: filtros.fim, semestre: filtros.semestre };
  return <BotaoExportar onExportar={data && iesNome ? () => baixar('questoes', iesNome, secoesQuestoes(data, recorte)) : undefined} />;
}

function ExportarConteudos({ filtros, iesNome }: BotaoExportarAbaProps) {
  const { data } = useEngajamentoConteudos(filtros);
  const recorte: RecorteExportacao = { inicio: filtros.inicio, fim: filtros.fim, semestre: filtros.semestre, tipo: filtros.tipo };
  return <BotaoExportar onExportar={data && iesNome ? () => baixar('conteudos', iesNome, secoesConteudos(data, recorte)) : undefined} />;
}

export function BotaoExportarAba(props: BotaoExportarAbaProps) {
  const { pathname } = useLocation();
  const aba = abaDe(pathname);
  if (aba === 'questoes') return <ExportarQuestoes {...props} />;
  if (aba === 'conteudos') return <ExportarConteudos {...props} />;
  return <ExportarVisaoGeral {...props} />;
}
