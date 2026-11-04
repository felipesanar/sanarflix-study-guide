import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { FiltrosRecorteEngajamento } from '@/features/gestor/api/engajamento';
import type { NivelEngajamento as Nivel, VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { rotuloPeriodoMinusculo } from '@/features/gestor/lib/engajamento';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';
import { ListaAlunosDialog } from './ListaAlunosDialog';

export interface NivelEngajamentoProps {
  dados: VisaoGeralEngajamento | undefined;
  consulta: ConsultaDoBloco;
  /** Recorte da página, repassado ao pop-up de lista. */
  filtros: FiltrosRecorteEngajamento & { periodo: string };
}

interface CartaoNivel {
  nivel: Nivel;
  nome: string;
  regra: string;
  icone: DendeIconName;
  /** Topo e ponto do cartão. */
  cor: string;
  /** Número e nome. */
  texto: string;
  chip: { fundo: string; borda: string; texto: string };
}

/** Ordem fixa dos cartões, nomes, regras (§12.2) e cores (§13: família semântica). */
const CARTOES: CartaoNivel[] = [
  {
    nivel: 'frequente',
    nome: 'Ativo e frequente',
    regra: 'Acessou nos últimos 30 dias e estudou em 15 dias ou mais nesse intervalo',
    icone: 'arrow_upward',
    cor: 'var(--gp-success)',
    texto: 'var(--gp-success-on)',
    chip: { fundo: 'var(--gp-success-surface)', borda: 'var(--gp-success)', texto: 'var(--gp-success-on)' },
  },
  {
    nivel: 'esporadico',
    nome: 'Ativo, mas esporádico',
    regra: 'Acessou nos últimos 30 dias, mas estudou em menos de 15 dias',
    icone: 'arrow_right',
    cor: 'var(--gp-warning)',
    texto: 'var(--gp-warning-on)',
    chip: { fundo: 'var(--gp-warning-surface)', borda: 'var(--gp-warning)', texto: 'var(--gp-warning-on)' },
  },
  {
    nivel: 'parou',
    nome: 'Era frequente e parou',
    regra: 'Sem atividade há mais de 30 dias, mas teve algum mês do período com 15 dias ativos ou mais',
    icone: 'arrow_downward',
    cor: 'var(--gp-danger)',
    texto: 'var(--gp-danger-on)',
    chip: { fundo: 'var(--gp-danger-surface)', borda: 'var(--gp-danger)', texto: 'var(--gp-danger-on)' },
  },
  {
    nivel: 'nunca',
    nome: 'Nunca engajou',
    regra: 'Sem atividade há mais de 30 dias e nenhum mês com 15 dias ativos, ou nunca acessou',
    icone: 'remove',
    cor: 'var(--gp-text-3)',
    texto: 'var(--gp-text-1)',
    chip: { fundo: 'var(--gp-surface-3)', borda: 'var(--gp-border-input)', texto: 'var(--gp-text-1)' },
  },
];

/**
 * "Nível de engajamento" (spec §4.4, §12.2): 4 cartões que somam a base ativa.
 * Cada um mostra a contagem, o percentual da base do recorte, 3 alunos de
 * exemplo e, quando há mais, o botão "+N" que abre a lista completa.
 */
export function NivelEngajamento({ dados, consulta, filtros }: NivelEngajamentoProps) {
  const [aberto, setAberto] = React.useState<CartaoNivel | null>(null);

  const base = dados?.kpis.baseAtiva ?? 0;
  const comAluno = Boolean(dados?.recorte.aluno);
  const total = (nivel: Nivel) => dados?.niveis.find((n) => n.nivel === nivel);

  return (
    <BlocoEngajamento
      titulo="Nível de engajamento"
      descricao="Combina recência (acessou nos últimos 30 dias?) com frequência (quantos dias estudou) · toda a base ativa cai em exatamente uma categoria"
      consulta={consulta}
      alturaSkeleton={260}
      bloco="nivel-engajamento"
      rodape={
        dados
          ? `As quatro categorias somam a base ativa (${comAluno ? '1 aluno' : `${formatNumero(base)} alunos`}). Régua única: 15 dias ativos em 30 (ou num mês) define "frequente".`
          : undefined
      }
    >
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {dados
          ? CARTOES.map((c) => {
              const n = total(c.nivel);
              const quantidade = n?.total ?? 0;
              const amostra = n?.amostra ?? [];
              const restantes = quantidade - amostra.length;
              return (
                <article
                  key={c.nivel}
                  data-testid={`nivel-${c.nivel}`}
                  className="flex flex-col"
                  style={{
                    gap: 10,
                    padding: 14,
                    borderRadius: 'var(--gp-radius-md)',
                    border: '1px solid var(--gp-border-strong)',
                    borderTop: `3px solid ${c.cor}`,
                    background: 'var(--gp-surface-1)',
                  }}
                >
                  <header className="flex items-center" style={{ gap: 6 }}>
                    <span aria-hidden="true" style={{ color: c.texto, display: 'inline-flex' }}>
                      <Icon name={c.icone} size={16} />
                    </span>
                    <h3 style={{ fontSize: 'var(--gp-font-size-h3)', fontWeight: 'var(--gp-font-weight-forte)', color: c.texto }}>
                      {c.nome}
                    </h3>
                    <button
                      type="button"
                      aria-label={c.regra}
                      title={c.regra}
                      className="ml-auto inline-flex"
                      style={{ color: 'var(--gp-text-3)' }}
                    >
                      <Icon name="info" size={14} />
                    </button>
                  </header>
                  <p style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)', lineHeight: '15px' }}>{c.regra}</p>

                  <div className="flex items-baseline" style={{ gap: 6 }}>
                    <span
                      data-testid="nivel-total"
                      className="tabular-nums"
                      style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: '34px', color: c.texto }}
                    >
                      {formatNumero(quantidade)}
                    </span>
                    <span
                      className="uppercase"
                      style={{
                        fontSize: 'var(--gp-font-size-micro)',
                        letterSpacing: 'var(--gp-font-tracking-micro)',
                        color: 'var(--gp-text-3)',
                      }}
                    >
                      ALUNOS · {formatPct(base > 0 ? (100 * quantidade) / base : null)}
                    </span>
                  </div>

                  {quantidade === 0 ? (
                    <p style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>
                      Nenhum aluno nesta categoria neste recorte
                    </p>
                  ) : (
                    <ul className="m-0 flex list-none flex-wrap p-0" style={{ gap: 6 }}>
                      {amostra.map((a) => (
                        <li
                          key={a.id}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--gp-radius-pill)',
                            background: c.chip.fundo,
                            border: `1px solid ${c.chip.borda}`,
                            color: c.chip.texto,
                            fontSize: 'var(--gp-font-size-apoio)',
                          }}
                        >
                          {a.nome}
                        </li>
                      ))}
                      {restantes > 0 ? (
                        <li>
                          <button
                            type="button"
                            aria-label={`Ver todos os ${formatNumero(quantidade)} alunos com ${c.nome.toLowerCase()}`}
                            onClick={() => setAberto(c)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--gp-radius-pill)',
                              border: `1px dashed ${c.chip.borda}`,
                              color: c.chip.texto,
                              fontSize: 'var(--gp-font-size-apoio)',
                              fontWeight: 'var(--gp-font-weight-medio)',
                            }}
                          >
                            +{formatNumero(restantes)}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  )}
                </article>
              );
            })
          : null}
      </div>

      {aberto && dados ? (
        <ListaAlunosDialog
          categoria={aberto.nivel}
          titulo={aberto.nome}
          regra={aberto.regra}
          colunaDetalhe={aberto.nivel === 'parou' || aberto.nivel === 'nunca' ? 'melhorMes' : 'ultima'}
          filtros={filtros}
          iesNome={dados.ies.nome}
          periodoRotulo={rotuloPeriodoMinusculo(filtros.periodo, dados.periodo.hoje)}
          alunoNome={dados.recorte.aluno?.nome ?? null}
          onFechar={() => setAberto(null)}
        />
      ) : null}
    </BlocoEngajamento>
  );
}
