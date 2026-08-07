import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { Icon } from '@/features/gestor/components/Icon';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { rotuloGrupo } from '@/features/gestor/lib/rotulos';
import type { GrupoEvolucao, VisaoGeral } from '@/features/gestor/api/types';

/**
 * Sem `dispersao`, `tendencia` nem `onSelecionarAluno` desde 07/08: a
 * dispersão que este bloco desenhava era o MESMO gráfico do modo "Aluno" do
 * gráfico protagonista, no topo da mesma tela. Ver o comentário no corpo do
 * componente. Os três seguem vivos em `GraficoProtagonista`/`DispersaoChart`,
 * que é quem desenha aquele gráfico agora — e onde o clique no ponto abre o
 * drawer do aluno.
 */
export interface VisaoDeAlunosProps {
  distribuicao: VisaoGeral['distribuicaoAlunos'];
  /**
   * Âncora da tabela de alunos na mesma tela — destino do "Ver visão detalhada".
   * A copy é fechada no handoff (docs/01, §Copy): nunca "drill-down".
   */
  alvoDetalhe?: string;
  /**
   * Quando fornecido, o CTA passa a ALTERNAR a tabela de alunos em vez de
   * navegar até ela: a tela só monta o detalhe micro quando o gestor pede.
   *
   * Sem o callback (uso isolado, sem uma tela em volta que saiba abrir nada),
   * o CTA continua sendo a âncora de sempre para `alvoDetalhe` — que é o
   * comportamento correto quando a tabela já está na página.
   */
  onAlternarDetalhe?: () => void;
  /** Só faz sentido com `onAlternarDetalhe`: dita o rótulo e o `aria-expanded`. */
  detalheAberto?: boolean;
}

/** Ordem fixa de exibição dos 3 grupos de evolução (mesmo espírito do `ORDEM_NIVEL` de `CascataDiagnostico`). */
const ORDEM_GRUPO: GrupoEvolucao[] = [
  'consistentemente_proficiente',
  'em_variacao',
  'consistentemente_nao_proficiente',
];

/**
 * Semáforo dos 3 grupos por token semântico. Antes eram classes de paleta crua
 * do Tailwind (`bg-emerald-600`/`bg-amber-500`/`bg-red-600`), que não existem no
 * tema do portal: não acompanhavam o tema escuro nem a calibragem de contraste
 * feita nos tokens `--gp-*`.
 */
const COR_GRUPO: Record<GrupoEvolucao, string> = {
  consistentemente_proficiente: 'var(--gp-success)',
  em_variacao: 'var(--gp-warning)',
  consistentemente_nao_proficiente: 'var(--gp-danger)',
};

/**
 * Bloco "Visão de Alunos" (resumo) da Visão Geral (spec §4.8): distribuição
 * por grupo de evolução + dispersão de proficiência por semestre, com linha
 * de tendência quando o backend a fornece. Vem DEPOIS do Diagnóstico
 * Curricular — a referência promove o diagnóstico para logo abaixo do gráfico
 * protagonista (`<!-- Diagnóstico (promovido) -->`).
 */
export function VisaoDeAlunos({
  distribuicao,
  alvoDetalhe = '#alunos-detalhe',
  onAlternarDetalhe,
  detalheAberto = false,
}: VisaoDeAlunosProps) {
  const porGrupo = new Map(distribuicao.map((item) => [item.grupo, item]));

  /**
   * Mesma roupa nos dois desfechos (botão que abre a tabela · âncora que
   * navega até ela): a diferença é de mecânica, não de aparência, e o CTA não
   * pode mudar de peso conforme quem o monta.
   */
  const ROUPA_CTA = {
    className:
      'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-3.5 py-2 transition-colors hover:bg-[color:var(--gp-brand-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--gp-brand-on-dark)',
      border: '1px solid var(--gp-brand-border)',
    } satisfies React.CSSProperties,
  };

  return (
    /*
     * O bloco inteiro num card só, e não dois cards soltos sob um título sem
     * moldura.
     *
     * Do jeito anterior, "Visão de Alunos" era o único bloco da Visão Geral
     * cujo cabeçalho flutuava direto sobre o fundo da página, entre o
     * Diagnóstico (em cards) e a tabela de alunos (em card) — lia como
     * sobra de conteúdo entre dois blocos, não como bloco. Agora tem a mesma
     * casca do gráfico protagonista e do cronograma, e a distribuição e a
     * dispersão viram duas partes DELE, separadas por um divisor, em vez de
     * dois cartões concorrentes.
     */
    <section data-testid="bloco-visao-alunos" aria-labelledby="titulo-visao-alunos">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <h2 id="titulo-visao-alunos" style={{ fontSize: 16, fontWeight: 700 }}>
              Visão de Alunos
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Distribuição por grupo de evolução e dispersão de proficiência por semestre.
            </p>
          </div>
          {/*
           * CTA com corpo de botão, não link de texto.
           *
           * É a única ponte entre o resumo e a tabela de alunos lá embaixo, e
           * como texto de 12px encostado na borda direita ele desaparecia ao
           * lado de "Ver temas", "Ver cronograma" e do resto da tela.
           * Continua sendo um `<a>` com âncora de verdade (abre em nova aba,
           * copia endereço, funciona sem JS) — muda a rou­pa, não a natureza.
           */}
          {onAlternarDetalhe ? (
            <button
              type="button"
              data-testid="link-visao-detalhada"
              aria-expanded={detalheAberto}
              aria-controls={alvoDetalhe.replace('#', '')}
              onClick={onAlternarDetalhe}
              {...ROUPA_CTA}
            >
              {detalheAberto ? 'Ocultar visão detalhada' : 'Ver visão detalhada'}
              <Icon name={detalheAberto ? 'expand_more' : 'chevron_right'} size={14} />
            </button>
          ) : (
            <a href={alvoDetalhe} data-testid="link-visao-detalhada" {...ROUPA_CTA}>
              Ver visão detalhada
              <Icon name="chevron_right" size={14} />
            </a>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div data-testid="distribuicao-alunos">
            {distribuicao.length === 0 ? (
              <div data-testid="distribuicao-vazia">
                <EstadoVazio titulo="Sem alunos com resultado neste recorte" className="border-none p-0" />
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-3">
                {ORDEM_GRUPO.map((grupo) => {
                  const item = porGrupo.get(grupo);
                  const quantidade = item?.quantidade ?? null;
                  const percentual = item?.percentual ?? null;
                  return (
                    <li key={grupo}>
                      <div data-testid={`grupo-${grupo}`} className="space-y-2 rounded-md border border-border p-3">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ background: COR_GRUPO[grupo] }}
                          />
                          {rotuloGrupo(grupo)}
                        </span>
                        <span className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold tabular-nums">{formatNumero(quantidade)}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{formatPct(percentual)}</span>
                        </span>
                        <div
                          role="progressbar"
                          aria-label={`Participação de ${rotuloGrupo(grupo)}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          /**
                           * `percentual: null` é ausência de medida, não zero
                           * (§4.10). Omitir `aria-valuenow` deixa a progressbar
                           * INDETERMINADA por WAI-ARIA — o leitor de tela não
                           * anuncia "0 por cento" para dado que ninguém mediu,
                           * igual ao rótulo visível, que já mostra TRACO. A
                           * largura da barra cai a 0 porque é só decoração.
                           */
                          aria-valuenow={percentual === null ? undefined : Math.round(percentual)}
                          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${percentual ?? 0}%`, background: COR_GRUPO[grupo] }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/*
            "Proficiência por semestre" saiu daqui (reunião de 07/08).

            Era o MESMO gráfico do modo "Aluno" do gráfico protagonista, no
            topo da mesma tela — mesma `dispersao`, mesmo componente, mesmo
            eixo. "Aluno por semestre e proficiência por semestre: é a mesma
            coisa. Tira ele, ou deixa ele só aqui [em cima]." Duas cópias do
            mesmo gráfico numa tela não somam leitura: dividem a atenção e
            fazem o gestor procurar a diferença que não existe. Fica a de
            cima, que é onde o seletor de modo dá contexto — e onde o clique
            no ponto abre o drawer do aluno.
          */}
        </CardContent>
      </Card>
    </section>
  );
}
