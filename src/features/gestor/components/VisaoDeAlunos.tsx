import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { Icon } from '@/features/gestor/components/Icon';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { ROTULO_GRUPO_PLURAL, rotuloGrupo } from '@/features/gestor/lib/rotulos';
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
  /**
   * Quantos simulados COM RESULTADO entram no recorte — a segunda metade da
   * nota de contexto do cabeçalho ("104 alunos · 3 simulados", na referência).
   * `undefined` quando o chamador não sabe: a nota mostra só a contagem de
   * alunos, nunca um "0 simulados" inventado sobre dado que ninguém mediu
   * (§4.10).
   */
  totalSimulados?: number;
  /**
   * População matriculada da IES no recorte vigente —
   * `VisaoGeral.alunosMatriculadosNoRecorte` (campo novo confirmado em
   * produção em `get_gestor_visao_geral`), passado pelo chamador
   * (`VisaoGeral.tsx`) inteiro, sem recorte deste componente.
   *
   * Existe para contextualizar `totalAlunos` abaixo: aquele número é a soma
   * de `distribuicao`, que só conta quem tem ao menos um resultado de TRI no
   * recorte — SEMPRE menor ou igual à população real, e tipicamente menor
   * (bug já documentado, não é o que esta prop corrige — ela só dá o
   * denominador honesto para a gestora entender o tamanho do corte).
   * `undefined` quando o chamador não sabe: a linha secundária de contexto
   * não aparece, em vez de inventar um total.
   */
  totalMatriculados?: number;
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
  totalSimulados,
  totalMatriculados,
}: VisaoDeAlunosProps) {
  const porGrupo = new Map(distribuicao.map((item) => [item.grupo, item]));

  /** Base da nota de contexto e do denominador implícito da barra empilhada. */
  const totalAlunos = distribuicao.reduce((soma, item) => soma + item.quantidade, 0);
  const proficientes = porGrupo.get('consistentemente_proficiente')?.quantidade ?? null;

  /**
   * Mesma roupa nos dois desfechos (botão que abre a tabela · âncora que
   * navega até ela): a diferença é de mecânica, não de aparência, e o CTA não
   * pode mudar de peso conforme quem o monta.
   *
   * Voltou a ser LINK de texto (07/08, refino sobre a referência): o botão
   * contornado que ele virou em 06/08 competia com o CTA do Diagnóstico logo
   * acima, e a referência desenha os dois iguais — 12px/600 na cor da marca,
   * com o chevron colado, ancorados à direita do cabeçalho do bloco.
   */
  const ROUPA_CTA = {
    className:
      'ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--gp-brand-on-dark)',
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
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 pb-4">
          <h2 id="titulo-visao-alunos" style={{ fontSize: 16, fontWeight: 700 }}>
            Visão de Alunos
          </h2>
          {/* Nota de contexto INLINE, ao lado do título — o mesmo aposto de
              11px do cabeçalho do Diagnóstico. Trocou a frase que descrevia o
              método ("distribuição por grupo de evolução e dispersão...") pelo
              TAMANHO do recorte, que é o que a gestora precisa saber para ler
              os números logo abaixo. A dispersão saiu deste bloco em 07/08 e a
              frase antiga ainda a prometia. */}
          <span
            data-testid="visao-alunos-contexto"
            className="ml-1.5 min-w-0 truncate text-[11px] text-muted-foreground"
          >
            {formatNumero(totalAlunos)} {totalAlunos === 1 ? 'aluno' : 'alunos'}
            {totalSimulados === undefined
              ? null
              : ` · ${formatNumero(totalSimulados)} ${totalSimulados === 1 ? 'simulado' : 'simulados'}`}
          </span>
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
          {/*
            Linha secundária de contexto, abaixo da nota do cabeçalho: o "N
            alunos" ali é `distribuicao.reduce(...)`, que só conta quem tem
            resultado de TRI no recorte — bem menor que a população
            matriculada real (bug já documentado, não corrigido aqui). Sem
            `totalMatriculados` (chamador não sabe o total), a linha não
            aparece — nunca um total inventado (§4.10).
          */}
          {totalMatriculados !== undefined ? (
            <p
              data-testid="visao-alunos-matriculados-contexto"
              className="text-[11px] text-muted-foreground"
            >
              {formatNumero(totalAlunos)} de {formatNumero(totalMatriculados)} alunos matriculados têm resultado
            </p>
          ) : null}
          <div data-testid="distribuicao-alunos">
            {distribuicao.length === 0 ? (
              <div data-testid="distribuicao-vazia">
                <EstadoVazio titulo="Sem alunos com resultado neste recorte" className="border-none p-0" />
              </div>
            ) : (
              /*
               * Duas colunas, como na referência: a leitura de UMA linha à
               * esquerda (a barra empilhada + o número que ela destaca) e o
               * detalhe por grupo à direita.
               *
               * As três barrinhas individuais que existiam aqui — uma
               * progressbar por cartão, cada uma com seu próprio trilho — não
               * compunham nada: três percentuais de um mesmo total desenhados
               * em três réguas separadas obrigam a somar de cabeça para ver
               * que dão 100%. A barra EMPILHADA é a mesma informação em uma
               * figura só, e é ela que responde "como está dividida a
               * instituição" de relance.
               */
              <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_2fr] lg:gap-7">
                <div className="flex flex-col gap-3">
                  {/*
                   * Uma progressbar só, sobre o grupo que o número grande logo
                   * abaixo nomeia — os outros dois segmentos são leitura visual
                   * da mesma divisão, já anunciada nos cartões ao lado com
                   * número e percentual próprios. Repetir três `role=progressbar`
                   * empilhados faria o leitor de tela ler a divisão duas vezes.
                   */}
                  <div
                    data-testid="barra-empilhada"
                    role="progressbar"
                    aria-label={`Participação de ${rotuloGrupo('consistentemente_proficiente')}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={
                      porGrupo.get('consistentemente_proficiente')?.percentual == null
                        ? undefined
                        : Math.round(porGrupo.get('consistentemente_proficiente')!.percentual!)
                    }
                    className="flex overflow-hidden"
                    style={{ height: 18, borderRadius: 'var(--gp-radius-pill)', gap: 2 }}
                  >
                    {ORDEM_GRUPO.map((grupo) => (
                      <div
                        key={grupo}
                        style={{
                          width: `${porGrupo.get(grupo)?.percentual ?? 0}%`,
                          background: COR_GRUPO[grupo],
                        }}
                      />
                    ))}
                  </div>
                  <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: '30px' }}>
                    <span className="tabular-nums">{formatNumero(proficientes)}</span>{' '}
                    <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--gp-text-3)' }}>
                      {`${proficientes === 1 ? 'aluno' : 'alunos'} ${ROTULO_GRUPO_PLURAL.consistentemente_proficiente}`}
                    </span>
                  </p>
                </div>

                <ul className="grid gap-3.5 sm:grid-cols-3">
                  {ORDEM_GRUPO.map((grupo) => {
                    const item = porGrupo.get(grupo);
                    const quantidade = item?.quantidade ?? null;
                    const percentual = item?.percentual ?? null;
                    return (
                      <li key={grupo}>
                        <div
                          data-testid={`grupo-${grupo}`}
                          className="border border-border p-3.5"
                          style={{ borderRadius: 12 }}
                        >
                          {/* Ponto + número no topo; o rótulo desce para a
                              legenda, em 11px — a ordem da referência. O que o
                              cartão responde primeiro é "quantos", e o nome do
                              grupo qualifica esse número, não o contrário. */}
                          <span className="flex items-center gap-[7px]">
                            <span
                              aria-hidden="true"
                              className="inline-block shrink-0"
                              style={{ width: 10, height: 10, borderRadius: 3, background: COR_GRUPO[grupo] }}
                            />
                            <span className="tabular-nums" style={{ fontSize: 20, fontWeight: 700 }}>
                              {formatNumero(quantidade)}
                            </span>
                          </span>
                          <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                            {ROTULO_GRUPO_PLURAL[grupo]}{' '}
                            <span className="tabular-nums" style={{ color: 'var(--gp-text-2)', fontWeight: 600 }}>
                              {formatPct(percentual)}
                            </span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
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
