import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/features/gestor/components/Icon';
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
import { useEngajamentoConteudoAlunos, type FiltrosRecorteEngajamento } from '@/features/gestor/api/engajamento';
import type { ChaveConteudo } from '@/features/gestor/api/types-engajamento';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import { diasDesdeSaoPaulo, formatarAtualizadoEm, rotuloRecencia } from '@/features/gestor/lib/engajamento';
import { formatNumero } from '@/features/gestor/lib/formatters';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';

/** A RPC devolve os 12 alunos com mais aberturas do conteúdo. */
const TOPO = 12;

export interface AlunosDoConteudoDialogProps {
  conteudo: ChaveConteudo;
  filtros: FiltrosRecorteEngajamento;
  onFechar: () => void;
}

/**
 * Pop-up de um conteúdo (spec §8.8, §12.4): os 12 alunos com mais aberturas. "Última
 * abertura" chega em UTC; o dia é calculado em America/Sao_Paulo e o horário
 * exato fica no `title`.
 */
export function AlunosDoConteudoDialog({ conteudo, filtros, onFechar }: AlunosDoConteudoDialogProps) {
  useDevolverFocoAoFechar(true);
  const container = useGestorPortalContainer();
  const consulta = useEngajamentoConteudoAlunos(filtros, conteudo);
  const dados = consulta.data;
  const tipo = dados?.conteudo.tipo === 'video' ? 'vídeo' : dados?.conteudo.tipo === 'document' ? 'documento' : null;

  return (
    <Dialog open onOpenChange={(aberto) => (aberto ? undefined : onFechar())}>
      <DialogContent
        container={container}
        closeLabel="Fechar"
        closeIcon={<Icon name="close" size={16} />}
        className="flex max-h-[90vh] max-w-3xl flex-col"
        data-testid="alunos-do-conteudo-dialog"
      >
        <DialogHeader>
          <p
            className="uppercase"
            style={{ fontSize: 'var(--gp-font-size-label)', letterSpacing: 'var(--gp-font-tracking-label)', color: 'var(--gp-text-3)' }}
          >
            {conteudo.especialidade} › {conteudo.modulo}
          </p>
          <DialogTitle>{dados?.conteudo.nome ?? 'Alunos que consumiram'}</DialogTitle>
          <DialogDescription>
            {dados
              ? [`${formatNumero(dados.resumo.alunos)} alunos`, `${formatNumero(dados.resumo.consumos)} consumos`, tipo].filter(Boolean).join(' · ')
              : consulta.isError
                ? 'Não foi possível carregar os alunos'
                : 'Carregando alunos'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {consulta.isError && !dados ? (
            <EstadoErro altura={160} onRetry={consulta.refetch} />
          ) : (
            <TabelaGestor rotulo="Alunos que consumiram o conteúdo">
              <CabecalhoTabela>
                <tr>
                  <CelulaCabecalho>Aluno</CelulaCabecalho>
                  <CelulaCabecalho>Semestre</CelulaCabecalho>
                  <CelulaCabecalho numerica>Aberturas</CelulaCabecalho>
                  <CelulaCabecalho>Última abertura</CelulaCabecalho>
                </tr>
              </CabecalhoTabela>
              <CorpoTabela>
                {!dados ? (
                  <LinhasSkeleton colunas={4} linhas={5} />
                ) : dados.alunos.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--gp-text-3)', fontSize: 'var(--gp-font-size-body)' }}>
                      Nenhum aluno consumiu este conteúdo neste recorte.
                    </td>
                  </tr>
                ) : (
                  dados.alunos.map((a, i) => (
                    <LinhaTabela key={a.id} ultima={i === dados.alunos.length - 1}>
                      <Celula>{a.nome}</Celula>
                      <Celula>{a.semestre}º</Celula>
                      <Celula numerica>{formatNumero(a.aberturas)}</Celula>
                      <Celula>
                        <span title={formatarAtualizadoEm(a.ultimaAbertura) ?? undefined}>{rotuloRecencia(diasDesdeSaoPaulo(a.ultimaAbertura))}</span>
                      </Celula>
                    </LinhaTabela>
                  ))
                )}
              </CorpoTabela>
            </TabelaGestor>
          )}
        </div>

        {dados && dados.resumo.alunos > TOPO ? (
          <p style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>
            Mostrando os {TOPO} alunos com mais aberturas de {formatNumero(dados.resumo.alunos)}.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
