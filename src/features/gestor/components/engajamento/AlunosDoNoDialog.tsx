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
import { useEngajamentoQuestoesAlunos, type FiltrosRecorteEngajamento } from '@/features/gestor/api/engajamento';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import { formatData, formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import { BarraHorizontal } from './BarraHorizontal';

/** A RPC devolve os 12 alunos com mais questões no nó. */
const TOPO = 12;

export interface AlunosDoNoDialogProps {
  /** Tema (clínico) ou assunto (básico). */
  folhaId: string;
  filtros: FiltrosRecorteEngajamento;
  onFechar: () => void;
}

/**
 * Pop-up "alunos que resolveram" de um tema ou assunto (spec §8.6, §12.3): os 12
 * alunos com mais questões no nó, com acerto e a última vez que resolveram questão
 * dele no período.
 */
export function AlunosDoNoDialog({ folhaId, filtros, onFechar }: AlunosDoNoDialogProps) {
  useDevolverFocoAoFechar(true);
  const container = useGestorPortalContainer();
  const consulta = useEngajamentoQuestoesAlunos(filtros, folhaId);
  const dados = consulta.data;

  return (
    <Dialog open onOpenChange={(aberto) => (aberto ? undefined : onFechar())}>
      <DialogContent
        container={container}
        closeLabel="Fechar"
        closeIcon={<Icon name="close" size={16} />}
        className="flex max-h-[90vh] max-w-3xl flex-col"
        data-testid="alunos-do-no-dialog"
      >
        <DialogHeader>
          {dados ? (
            <p
              className="uppercase"
              style={{ fontSize: 'var(--gp-font-size-label)', letterSpacing: 'var(--gp-font-tracking-label)', color: 'var(--gp-text-3)' }}
            >
              {dados.no.caminho[0]} › {dados.no.caminho[1]}
            </p>
          ) : null}
          <DialogTitle>{dados ? dados.no.nome : 'Alunos que resolveram'}</DialogTitle>
          <DialogDescription>
            {dados
              ? `${formatNumero(dados.resumo.alunos)} alunos resolveram · ${formatNumero(dados.resumo.questoes)} questões · ${formatPct(dados.resumo.acertoPct)} de acerto`
              : consulta.isError
                ? 'Não foi possível carregar os alunos'
                : 'Carregando alunos'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {consulta.isError && !dados ? (
            <EstadoErro altura={160} onRetry={consulta.refetch} />
          ) : (
            <TabelaGestor rotulo={dados ? `Alunos que resolveram ${dados.no.nome}` : 'Alunos que resolveram'}>
              <CabecalhoTabela>
                <tr>
                  <CelulaCabecalho>Aluno</CelulaCabecalho>
                  <CelulaCabecalho>Semestre</CelulaCabecalho>
                  <CelulaCabecalho numerica>Questões</CelulaCabecalho>
                  <CelulaCabecalho>Acerto</CelulaCabecalho>
                  <CelulaCabecalho>Última atividade</CelulaCabecalho>
                </tr>
              </CabecalhoTabela>
              <CorpoTabela>
                {!dados ? (
                  <LinhasSkeleton colunas={5} linhas={5} />
                ) : dados.alunos.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--gp-text-3)', fontSize: 'var(--gp-font-size-body)' }}>
                      Nenhum aluno resolveu questões deste nó neste recorte.
                    </td>
                  </tr>
                ) : (
                  dados.alunos.map((a, i) => (
                    <LinhaTabela key={a.id} ultima={i === dados.alunos.length - 1}>
                      <Celula>{a.nome}</Celula>
                      <Celula>{a.semestre}º</Celula>
                      <Celula numerica>{formatNumero(a.questoes)}</Celula>
                      <Celula>
                        <div className="flex items-center" style={{ gap: 8, minWidth: 110 }}>
                          <div className="min-w-0 flex-1">
                            <BarraHorizontal pct={a.acertoPct ?? 0} />
                          </div>
                          <span
                            className="tabular-nums"
                            data-testid="acerto-aluno"
                            style={{ minWidth: 34, textAlign: 'right', color: nivelDesempenho(a.acertoPct) === 'critico' ? 'var(--gp-danger-on)' : undefined }}
                          >
                            {a.acertoPct === null ? TRACO : formatPct(a.acertoPct)}
                          </span>
                        </div>
                      </Celula>
                      <Celula>{formatData(a.ultimaAtividade)}</Celula>
                    </LinhaTabela>
                  ))
                )}
              </CorpoTabela>
            </TabelaGestor>
          )}
        </div>

        {dados && dados.resumo.alunos > TOPO ? (
          <p style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>
            Mostrando os {TOPO} alunos com mais questões de {formatNumero(dados.resumo.alunos)}.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
