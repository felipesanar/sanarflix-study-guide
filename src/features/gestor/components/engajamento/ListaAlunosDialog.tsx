import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/features/gestor/components/Icon';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import {
  Celula,
  CabecalhoTabela,
  CelulaCabecalho,
  CorpoTabela,
  LinhaTabela,
  LinhasSkeleton,
  TabelaGestor,
} from '@/features/gestor/components/tabela';
import { buscarListaCompleta, useEngajamentoLista, type FiltrosRecorteEngajamento } from '@/features/gestor/api/engajamento';
import { useGestorContexto } from '@/features/gestor/api/queries';
import type { CategoriaLista, LinhaListaEngajamento } from '@/features/gestor/api/types-engajamento';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import { useValorComAtraso } from '@/features/gestor/hooks/useValorComAtraso';
import { baixarCsv, nomeArquivoCsv, type ColunaCsv } from '@/features/gestor/lib/exportarCsv';
import { mesAno, rotuloRecencia, slugIes, textoDetalhe } from '@/features/gestor/lib/engajamento';
import { formatNumero, TRACO } from '@/features/gestor/lib/formatters';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';

/** Linhas por página do pop-up (a RPC aceita 1–5.000). */
export const PAGE_SIZE_LISTA = 20;

const CATEGORIAS_FREQUENTE: CategoriaLista[] = ['frequente', 'esporadico'];
const CATEGORIAS_NIVEL: CategoriaLista[] = ['frequente', 'esporadico', 'parou', 'nunca'];

export type ColunaDetalhe = 'ultima' | 'melhorMes' | 'diasAtivosMes';

export interface ListaAlunosDialogProps {
  categoria: CategoriaLista;
  /** Nome do cartão ou da faixa. */
  titulo: string;
  /** Regra do cartão de nível; as faixas de recência não têm. */
  regra?: string;
  /** `ultima`: "Última atividade"; `melhorMes`: "Melhor mês" (níveis parou/nunca); `diasAtivosMes`: faixas do hábito. */
  colunaDetalhe: ColunaDetalhe;
  filtros: FiltrosRecorteEngajamento;
  iesNome: string;
  /** Rótulo do período em minúsculas ("últimos 6 meses"), para o subtítulo. */
  periodoRotulo: string;
  /** Nome do aluno filtrado, quando há. */
  alunoNome?: string | null;
  onFechar: () => void;
}

/** "filtro: {aluno}", "filtro: {n}º semestre" ou "{ies} · {período}" (§12.2). */
export function rotuloRecorteLista({
  alunoNome,
  semestre,
  iesNome,
  periodoRotulo,
}: {
  alunoNome?: string | null;
  semestre: number | null;
  iesNome: string;
  periodoRotulo: string;
}): string {
  if (alunoNome) return `filtro: ${alunoNome}`;
  if (semestre !== null) return `filtro: ${semestre}º semestre`;
  return `${iesNome} · ${periodoRotulo}`;
}

/** Texto da coluna de detalhe de uma linha (§12.2): depende da categoria e da coluna. */
export function textoDetalheLinha(
  linha: LinhaListaEngajamento,
  categoria: CategoriaLista,
  coluna: ColunaDetalhe,
): string {
  if (coluna === 'diasAtivosMes') return `${formatNumero(linha.diasAtivosMes)} dias ativos no mês`;
  if (coluna === 'melhorMes') {
    if (linha.melhorMes) return `${mesAno(linha.melhorMes)} · ${formatNumero(linha.melhorMesDias)} dias ativos`;
    return linha.diasSemAtividade === null ? '— (nunca acessou)' : '— (sem atividade no período)';
  }
  if (CATEGORIAS_FREQUENTE.includes(categoria)) {
    return `última: ${rotuloRecencia(linha.diasSemAtividade)} · ${formatNumero(linha.diasAtivos30)} dias ativos em 30`;
  }
  return textoDetalhe(linha.detalhe);
}

const CABECALHO_DETALHE: Record<ColunaDetalhe, string> = {
  ultima: 'Última atividade',
  melhorMes: 'Melhor mês',
  diasAtivosMes: 'Dias ativos no mês',
};

function mensagemVazio(categoria: CategoriaLista): string {
  return CATEGORIAS_NIVEL.includes(categoria)
    ? 'Nenhum aluno nesta categoria neste recorte'
    : 'Nenhum aluno nesta faixa neste recorte.';
}

/**
 * Pop-up de lista de alunos (spec §8.3, §12.2): "+N" dos cartões de Nível de
 * engajamento e "Ver lista completa" de Quem não voltou. Busca por nome (300 ms),
 * paginação de 20 e "Exportar CSV" (só com `podeExportar`; baixa até 5.000 linhas).
 */
export function ListaAlunosDialog({
  categoria,
  titulo,
  regra,
  colunaDetalhe,
  filtros,
  iesNome,
  periodoRotulo,
  alunoNome,
  onFechar,
}: ListaAlunosDialogProps) {
  useDevolverFocoAoFechar(true);
  const container = useGestorPortalContainer();
  const contexto = useGestorContexto();
  const podeExportar = contexto.data?.podeExportar === true;

  const [busca, setBusca] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [exportando, setExportando] = React.useState(false);
  const buscaAtrasada = useValorComAtraso(busca);

  // Mudar a busca volta a página para 1.
  React.useEffect(() => {
    setPage(1);
  }, [buscaAtrasada]);

  const consulta = useEngajamentoLista(filtros, categoria, buscaAtrasada, page, PAGE_SIZE_LISTA);
  const lista = consulta.data;
  const total = lista?.total ?? 0;
  const inicio = total === 0 ? 0 : (page - 1) * PAGE_SIZE_LISTA + 1;
  const fim = Math.min(page * PAGE_SIZE_LISTA, total);
  const totalPages = lista?.totalPages ?? 1;
  const cabecalhoDetalhe = CABECALHO_DETALHE[colunaDetalhe];

  const subtitulo = [
    `${formatNumero(total)} alunos`,
    regra,
    rotuloRecorteLista({ alunoNome, semestre: filtros.semestre, iesNome, periodoRotulo }),
  ]
    .filter(Boolean)
    .join(' · ');

  const exportar = async () => {
    setExportando(true);
    try {
      const completa = await buscarListaCompleta(filtros, categoria, buscaAtrasada);
      const colunas: ColunaCsv<LinhaListaEngajamento>[] = [
        { cabecalho: 'Aluno', valor: (l) => l.nome },
        { cabecalho: 'Semestre', valor: (l) => l.semestre },
        { cabecalho: cabecalhoDetalhe, valor: (l) => textoDetalheLinha(l, categoria, colunaDetalhe) },
        { cabecalho: 'Dias sem consumo', valor: (l) => l.diasSemAtividade },
      ];
      baixarCsv(nomeArquivoCsv(['engajamento', categoria, slugIes(iesNome)]), colunas, completa.data);
    } finally {
      setExportando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(aberto) => (aberto ? undefined : onFechar())}>
      <DialogContent
        container={container}
        closeLabel="Fechar lista"
        closeIcon={<Icon name="close" size={16} />}
        className="flex max-h-[90vh] max-w-3xl flex-col"
        data-testid="lista-alunos-dialog"
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{subtitulo}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Buscar aluno nesta lista</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--gp-text-3)' }}
            >
              <Icon name="search" size={16} />
            </span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aluno pelo nome"
              className="w-full bg-transparent"
              style={{
                height: 34,
                padding: '0 10px 0 32px',
                border: '1px solid var(--gp-border-input)',
                borderRadius: 'var(--gp-radius-sm)',
                fontSize: 'var(--gp-font-size-body)',
                color: 'var(--gp-text-1)',
              }}
            />
          </label>
          {podeExportar ? (
            <Button type="button" variant="outline" size="sm" onClick={exportar} disabled={exportando}>
              <Icon name="download" size={16} /> Exportar CSV
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={consulta.isPlaceholderData ? true : undefined}>
          {consulta.isError ? (
            <EstadoErro altura={160} onRetry={consulta.refetch} />
          ) : (
            <TabelaGestor rotulo={`Alunos: ${titulo}`}>
              <CabecalhoTabela>
                <tr>
                  <CelulaCabecalho>Aluno</CelulaCabecalho>
                  <CelulaCabecalho>Sem.</CelulaCabecalho>
                  <CelulaCabecalho>{cabecalhoDetalhe}</CelulaCabecalho>
                  <CelulaCabecalho numerica>Dias sem consumo</CelulaCabecalho>
                </tr>
              </CabecalhoTabela>
              <CorpoTabela>
                {consulta.isLoading || !lista ? (
                  <LinhasSkeleton colunas={4} linhas={5} />
                ) : lista.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ padding: 24, textAlign: 'center', color: 'var(--gp-text-3)', fontSize: 'var(--gp-font-size-body)' }}
                    >
                      {mensagemVazio(categoria)}
                    </td>
                  </tr>
                ) : (
                  lista.data.map((l, i) => (
                    <LinhaTabela key={l.id} ultima={i === lista.data.length - 1}>
                      <Celula>{l.nome}</Celula>
                      <Celula>{l.semestre}º</Celula>
                      <Celula>{textoDetalheLinha(l, categoria, colunaDetalhe)}</Celula>
                      <Celula numerica ausente={l.diasSemAtividade === null}>
                        {l.diasSemAtividade === null ? TRACO : formatNumero(l.diasSemAtividade)}
                      </Celula>
                    </LinhaTabela>
                  ))
                )}
              </CorpoTabela>
            </TabelaGestor>
          )}
        </div>

        {lista && total > 0 ? (
          <div className="flex flex-wrap items-center gap-3" style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>
            <span>
              Mostrando {formatNumero(inicio)}–{formatNumero(fim)} de {formatNumero(total)}
            </span>
            <span className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </span>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
