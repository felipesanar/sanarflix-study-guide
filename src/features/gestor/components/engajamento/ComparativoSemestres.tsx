import * as React from 'react';
import {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  LinhaTabela,
  TabelaGestor,
} from '@/features/gestor/components/tabela';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import type { VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { dec1 } from '@/features/gestor/lib/engajamento';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { BarraHorizontal } from './BarraHorizontal';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';

export interface ComparativoSemestresProps {
  dados: VisaoGeralEngajamento | undefined;
  consulta: ConsultaDoBloco;
  filtros: Pick<FiltrosEngajamento, 'semestre' | 'setSemestre'>;
}

const ROTULO_CICLO = { basico: 'básico', clinico: 'clínico', internato: 'internato' } as const;

const TEXTO_MARCA = 'text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]';

/**
 * "Comparativo entre semestres" (spec §12.2, P8): só os semestres que a IES tem
 * (base > 0; ex.: a FAI só tem o 12º), que ignoram o filtro de semestre e de aluno. Clicar no semestre filtra a página
 * (`eng_sem`), clicar de novo limpa. A linha selecionada leva o fundo de seleção
 * e a do semestre do aluno filtrado, o mais leve.
 */
export function ComparativoSemestres({ dados, consulta, filtros }: ComparativoSemestresProps) {
  const semestreDoAluno = dados?.recorte.aluno?.semestre ?? null;
  const semestresDaIes = (dados?.semestres ?? []).filter((s) => s.base > 0);
  const alternar = (n: number) => filtros.setSemestre(filtros.semestre === n ? null : n);

  return (
    <BlocoEngajamento
      titulo="Comparativo entre semestres"
      descricao="Clique num semestre para filtrar a página"
      consulta={consulta}
      alturaSkeleton={420}
      bloco="comparativo-semestres"
    >
      <TabelaGestor rotulo="Comparativo entre semestres">
        <CabecalhoTabela>
          <tr>
            <CelulaCabecalho>Semestre</CelulaCabecalho>
            <CelulaCabecalho numerica>Base</CelulaCabecalho>
            <CelulaCabecalho>Engajados</CelulaCabecalho>
            <CelulaCabecalho numerica>Vídeos / aluno</CelulaCabecalho>
            <CelulaCabecalho numerica>Docs / aluno</CelulaCabecalho>
            <CelulaCabecalho numerica>Questões / aluno</CelulaCabecalho>
            <CelulaCabecalho numerica>Acerto</CelulaCabecalho>
          </tr>
        </CabecalhoTabela>
        <CorpoTabela>
          {semestresDaIes.map((s, i, todos) => {
            const selecionado = filtros.semestre === s.semestre;
            const doAluno = !selecionado && semestreDoAluno === s.semestre;
            return (
              <LinhaTabela
                key={s.semestre}
                selecionada={selecionado}
                ultima={i === todos.length - 1}
                data-testid={`semestre-${s.semestre}`}
                style={
                  selecionado
                    ? { background: 'var(--gp-brand-surface)' }
                    : doAluno
                      ? { background: 'var(--gp-brand-surface-soft)' }
                      : undefined
                }
              >
                <Celula marcada={selecionado}>
                  <button
                    type="button"
                    aria-pressed={selecionado}
                    aria-label={`${s.semestre}º semestre`}
                    onClick={() => alternar(s.semestre)}
                    className={selecionado ? TEXTO_MARCA : undefined}
                    style={{ textAlign: 'left', fontWeight: 'var(--gp-font-weight-medio)' }}
                  >
                    {s.semestre}º{' '}
                    <span style={{ fontSize: 'var(--gp-font-size-micro)', fontWeight: 400, color: 'var(--gp-text-3)' }}>{ROTULO_CICLO[s.ciclo]}</span>
                  </button>
                </Celula>
                <Celula numerica>{formatNumero(s.base)}</Celula>
                <Celula>
                  <div className="flex items-center" style={{ gap: 8, minWidth: 120 }}>
                    <div className="min-w-0 flex-1">
                      <BarraHorizontal pct={s.engajadosPct ?? 0} />
                    </div>
                    <span className="tabular-nums" style={{ minWidth: 34, textAlign: 'right' }}>
                      {formatPct(s.engajadosPct)}
                    </span>
                  </div>
                </Celula>
                <Celula numerica>{dec1(s.videosPorEngajado)}</Celula>
                <Celula numerica>{dec1(s.documentosPorEngajado)}</Celula>
                <Celula numerica>{formatNumero(s.questoesPorEngajado)}</Celula>
                <Celula numerica>{formatPct(s.acertoPct)}</Celula>
              </LinhaTabela>
            );
          })}
        </CorpoTabela>
      </TabelaGestor>
    </BlocoEngajamento>
  );
}
