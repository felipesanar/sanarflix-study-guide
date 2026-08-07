import * as React from 'react';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AcoesRecorte } from '@/features/gestor/components/AcoesRecorte';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { FONTE_MONO, TagSituacao } from '@/features/gestor/components/tabela';
import { useAluno, useAlunoContato } from '@/features/gestor/api/queries';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import {
  TRACO,
  formatData,
  formatDelta,
  formatNumero,
  formatPct,
  rotuloSituacao,
} from '@/features/gestor/lib/formatters';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import { useToast } from '@/hooks/use-toast';
import type { AlunoSimuladoEntry } from '@/features/gestor/api/types';

export interface DrawerAlunoProps {
  alunoId: string | null;
  nome: string;
  /** Ids dos simulados em foco no recorte — vão direto para `useAluno`. */
  simulados: string[];
  onFechar: () => void;
  /**
   * Exportação do recorte do aluno. Opcional: as duas telas que montam este
   * drawer (Visão Geral e Detalhamento) ainda não têm export de verdade — o
   * §7.7 exige auditoria de quem/quando/escopo/formato, que nenhuma task
   * implementou. Sem o callback, o clique avisa que a exportação não está
   * disponível, como já faz o `DrawerTemas`; o que nunca acontece é o clique
   * ser engolido em silêncio.
   */
  onExportar?: (escopo: string) => void;
}

/** Iniciais do avatar: primeira letra do primeiro e do último nome. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return TRACO;
  const primeira = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}

/**
 * Sparkline de evolução da proficiência (docs/06 §6): sem eixo, sem grade,
 * 3 a 5 pontos, todos marcados, linha de meta tracejada.
 *
 * Só pontos MEDIDOS entram: simulado sem nota fica fora da série, nunca vira
 * zero nem interpolação entre vizinhos. Com menos de dois pontos não há
 * evolução para desenhar e o bloco inteiro não é renderizado pelo chamador.
 */
function EvolucaoSparkline({ pontos }: { pontos: { rotulo: string; valor: number }[] }) {
  const LARGURA = 348;
  const ALTURA = 76;
  const TOPO = 12;
  const BASE = 64;
  const MARGEM_X = 30;

  const y = (valor: number) => BASE - (valor / 100) * (BASE - TOPO);
  const x = (i: number) =>
    pontos.length === 1
      ? LARGURA / 2
      : MARGEM_X + (i * (LARGURA - MARGEM_X * 2)) / (pontos.length - 1);

  const linha = pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ');
  const descricao = pontos.map((p) => `${p.rotulo}: ${formatNumero(p.valor)}`).join('; ');

  return (
    <svg
      role="img"
      aria-label={`Evolução de proficiência — ${descricao}`}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <title>{`Evolução de proficiência — ${descricao}`}</title>
      <line
        x1={10}
        y1={y(PROFICIENCIA_MINIMA)}
        x2={LARGURA - 10}
        y2={y(PROFICIENCIA_MINIMA)}
        stroke="var(--gp-border-input)"
        strokeWidth={1}
        strokeDasharray="5 4"
      />
      <text
        x={LARGURA - 10}
        y={y(PROFICIENCIA_MINIMA) - 6}
        fontSize={9}
        fill="var(--gp-text-3)"
        textAnchor="end"
        fontFamily={FONTE_MONO}
      >
        {`meta ${PROFICIENCIA_MINIMA}`}
      </text>
      <polyline
        points={linha}
        fill="none"
        stroke="var(--gp-brand)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pontos.map((p, i) => (
        <circle key={p.rotulo} cx={x(i)} cy={y(p.valor)} r={4} fill="var(--gp-brand)" />
      ))}
    </svg>
  );
}

/** Rótulo de seção do drawer — 11px/700 uppercase, como a referência. */
function TituloSecao({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--gp-text-3)',
      }}
    >
      {children}
    </div>
  );
}

/** Uma grande área: rótulo em coluna fixa, barra de 8px e % em mono à direita. */
function BarraArea({ area, acertoPct, critica }: { area: string; acertoPct: number; critica: boolean }) {
  const cor = critica ? 'var(--gp-danger-on)' : undefined;
  return (
    <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--gp-text-2)' }}>
      <span style={{ width: 120, flex: 'none', color: cor, fontWeight: critica ? 600 : undefined }}>
        {area}
        {/* Cor nunca é canal único: a criticidade também sai por texto. */}
        {critica ? <span className="sr-only"> (área crítica)</span> : null}
      </span>
      <div
        role="progressbar"
        aria-label={`Percentual de acerto em ${area}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(acertoPct)}
        style={{
          flex: 1,
          height: 8,
          background: 'var(--gp-surface-3)',
          borderRadius: 'var(--gp-radius-pill)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${acertoPct}%`,
            height: '100%',
            background: critica ? 'var(--gp-danger)' : 'var(--gp-text-1)',
            borderRadius: 'var(--gp-radius-pill)',
          }}
        />
      </div>
      <span style={{ fontFamily: FONTE_MONO, width: 34, textAlign: 'right', color: cor }}>
        {formatPct(acertoPct)}
      </span>
    </div>
  );
}

/** Um card de métrica do drawer (Proficiência, Acertos, Posição, Variação). */
function CardMetrica({
  rotulo,
  children,
  destaque = false,
  testId,
}: {
  rotulo: string;
  children: React.ReactNode;
  destaque?: boolean;
  testId?: string;
}) {
  return (
    <div style={{ border: '1px solid var(--gp-border-strong)', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>{rotulo}</div>
      <div
        data-testid={testId}
        style={{
          fontSize: destaque ? 20 : 13,
          fontWeight: destaque ? 700 : 600,
          color: 'var(--gp-text-1)',
          fontFamily: FONTE_MONO,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Visão detalhada de um aluno (handoff §4.8).
 *
 * `useAluno` devolve **uma entrada por simulado** (`AlunoSimuladoEntry[]`),
 * nunca um objeto singular — a RPC materializa isso via `jsonb_agg`. Cada
 * entrada aqui vira a SUA PRÓPRIA seção: nenhum campo é somado, tirado média
 * ou fundido entre simulados (regra de "agregação honesta" do handoff —
 * mesma família de decisão de "Conceito ENAMED não tem média"). A sparkline
 * de evolução não viola isso: ela plota os MESMOS valores, um ponto por
 * simulado, sem produzir número novo.
 *
 * Uma única coluna de escala 0–100 por simulado, rotulada Proficiência —
 * nenhum rótulo "Nota TRI" nesta tela (§4.1, caso crítico nº2).
 */
export function DrawerAluno({ alunoId, nome, simulados, onFechar, onExportar }: DrawerAlunoProps) {
  const consulta = useAluno(alunoId, simulados);
  const contato = useAlunoContato(alunoId);
  const entradas: AlunoSimuladoEntry[] = consulta.data ?? [];

  /**
   * O nome vem PRIMEIRO da própria consulta, e só cai no prop como reserva.
   *
   * `get_gestor_aluno` já devolve `nome` em cada entrada, então o drawer não
   * precisa que o chamador saiba quem é o aluno — e depender do prop era um
   * defeito real: a Dispersão do Detalhamento só tem `alunoId` (o contrato de
   * `dispersao` é `{ alunoId, semestre, nota }`), então todo clique num ponto
   * do gráfico abria o painel com título vazio, iniciais vazias no avatar e
   * "— proficiência por simulado" no texto de exportação.
   */
  const nomeExibido = entradas[0]?.nome?.trim() || nome;
  useDevolverFocoAoFechar(Boolean(alunoId));
  const container = useGestorPortalContainer();
  const { toast } = useToast();

  if (!alunoId) return null;

  const semestre = entradas[0]?.semestre ?? null;

  /**
   * Cobertura do recorte. Numerador e denominador precisam sair do MESMO
   * conjunto: `entradas` vem de `get_gestor_aluno` e `simulados` é o recorte
   * que a tela pediu. Casar os dois crus (`entradas.length` sobre
   * `simulados.length`) misturava fontes com `WHERE` diferente — imprimia
   * "3 de 0" com o recorte vazio, e numerador maior que o denominador quando o
   * aluno tinha simulado fora do recorte. Contar por pertencimento faz a
   * fração se fechar sozinha; sem denominador, não há fração a mostrar.
   */
  const noRecorte = new Set(simulados);
  const cobertos = entradas.filter((e) => noRecorte.has(e.simuladoId)).length;
  const contexto = [
    `${semestre === null ? TRACO : `${semestre}º`} período`,
    simulados.length === 0
      ? null
      : `${cobertos} de ${simulados.length} ${simulados.length === 1 ? 'simulado' : 'simulados'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  /** Ordem cronológica para a série — a RPC já devolve assim, mas não custa garantir. */
  const cronologicas = [...entradas].sort((a, b) => a.simuladoData.localeCompare(b.simuladoData));
  const pontos = cronologicas
    .filter((e): e is AlunoSimuladoEntry & { proficiencia: number } => e.proficiencia !== null)
    .map((e) => ({ rotulo: e.simuladoNome, valor: e.proficiencia }));

  /**
   * §7.7: o texto do "Copiar resumo" é o recorte DESTE aluno, agregado por
   * simulado — nunca uma lista nominal de terceiros. A assinatura de
   * `AcoesRecorte` (`resumoTexto: string`) é a barreira: ele não recebe lista
   * de alunos e portanto não pode montar uma.
   */
  const resumoTexto = [
    `${nomeExibido} — proficiência por simulado`,
    ...cronologicas.map(
      (e) =>
        `${e.simuladoNome} (${formatData(e.simuladoData)}): proficiência ${formatNumero(e.proficiencia)} · acertos ${formatNumero(e.acertos)} · ${rotuloSituacao(e.situacao)}`,
    ),
  ].join('\n');

  const exportar = () => {
    if (onExportar) {
      onExportar(`aluno:${alunoId}`);
      return;
    }
    toast({ description: 'Exportação ainda não está disponível.' });
  };

  return (
    <Sheet
      open
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <SheetContent
        container={container}
        side="right"
        className="flex w-full flex-col gap-4 overflow-y-auto p-[22px] sm:max-w-[392px]"
        style={{ boxShadow: 'var(--gp-shadow-panel)' }}
        /*
          Os quatro slots do `SheetContent` existem para este portal. Sem eles o
          drawer herdava o fechar do shadcn: leitor de tela anunciando "Close"
          em inglês numa tela toda em pt-BR, o `X` do Lucide onde o handoff §3
          exige 100% Fontello do Dendê, e o scrim `bg-black/80` em vez do
          `--gp-scrim` do tema (42% no claro, 60% no escuro).
        */
        closeIcon={<Icon name="close" size={16} />}
        closeLabel="Fechar"
        /* Alvo de 30×30 com borda e raio 8px (handoff §4.5). O `opacity-100`
           está aqui para VENCER o `opacity-70` do shadcn no tailwind-merge —
           sem ele o alvo fica translúcido. */
        closeClassName="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] text-[color:var(--gp-text-3)] opacity-100"
        overlayClassName="bg-[var(--gp-scrim)]"
      >
        <SheetHeader className="space-y-0">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex items-center justify-center"
              style={{
                width: 42,
                height: 42,
                flex: 'none',
                borderRadius: '50%',
                background: 'var(--gp-brand-surface)',
                color: 'var(--gp-brand-on-dark)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {iniciais(nomeExibido)}
            </span>
            <div className="min-w-0 flex-1 text-left">
              <SheetTitle style={{ fontSize: 15, fontWeight: 700 }}>{nomeExibido}</SheetTitle>
              <SheetDescription style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                {consulta.isLoading ? 'Carregando dados do aluno' : contexto}
              </SheetDescription>
            </div>
          </div>
          {/*
            Telefone do aluno (decisão de Felipe, 31/07/reafirmada 05/08):
            dado de CONTATO, não métrica — por isso fica aqui, no cabeçalho,
            nunca na grade Proficiência/Acertos/Posição/Variação abaixo.
            Busca própria (`useAlunoContato`), independente de `consulta`:
            carrega quando o drawer abre, para este aluno, nunca em lote.
            Ausência (`telefone: null`) e erro caem no mesmo TRACO — nunca
            zero, nunca string vazia, nunca um espaço em branco.
          */}
          <p className="pt-2 text-left" style={{ fontSize: 12, color: 'var(--gp-text-3)' }}>
            <span style={{ fontWeight: 600, color: 'var(--gp-text-2)' }}>Telefone: </span>
            <span data-testid="drawer-telefone">
              {contato.isLoading ? 'Carregando telefone' : (contato.data?.telefone ?? TRACO)}
            </span>
          </p>
        </SheetHeader>

        {consulta.isLoading ? (
          <div className="space-y-2">
            <GestorSkeleton altura={96} rotulo="Carregando dados do aluno" />
            <GestorSkeleton altura={96} rotulo="Carregando dados do aluno" />
          </div>
        ) : consulta.isError ? (
          <EstadoErro titulo="Não foi possível carregar este aluno." onRetry={() => consulta.refetch()} />
        ) : entradas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum simulado neste recorte"
            descricao="Ajuste o recorte de simulados para ver os dados deste aluno."
          />
        ) : (
          <div className="flex-1 space-y-4">
            {/* Comparativo entre simulados: só existe com 2+ pontos medidos. */}
            {pontos.length > 1 ? (
              <div data-testid="drawer-evolucao" className="space-y-2">
                <TituloSecao>Evolução de proficiência</TituloSecao>
                <EvolucaoSparkline pontos={pontos} />
              </div>
            ) : null}

            {cronologicas.map((entrada) => {
              const areas = entrada.acertoPorArea ?? [];
              const areaCritica = areas.find((a) => a.critica);
              return (
                <article
                  key={entrada.simuladoId}
                  data-testid={`drawer-simulado-${entrada.simuladoId}`}
                  className="space-y-3 p-3"
                  style={{ border: '1px solid var(--gp-border-strong)', borderRadius: 12 }}
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gp-text-1)' }}>
                        {entrada.simuladoNome}
                      </h3>
                      <p style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                        {formatData(entrada.simuladoData)}
                      </p>
                    </div>
                    <TagSituacao situacao={entrada.situacao} />
                  </header>

                  <div className="grid grid-cols-2 gap-2.5">
                    <CardMetrica rotulo="Proficiência" destaque testId={`drawer-proficiencia-${entrada.simuladoId}`}>
                      {formatNumero(entrada.proficiencia)}
                    </CardMetrica>
                    <CardMetrica rotulo="Acertos" destaque>
                      {formatNumero(entrada.acertos)}
                    </CardMetrica>
                    <CardMetrica rotulo="Posição">
                      {/* Percentil junto do lugar: o contrato já traz os três
                          campos, e sozinho o lugar não diz onde o aluno está
                          na turma sem que o gestor faça a conta. */}
                      {entrada.posicao
                        ? `${entrada.posicao.lugar}º de ${entrada.posicao.total} · percentil ${entrada.posicao.percentil}`
                        : TRACO}
                    </CardMetrica>
                    <CardMetrica rotulo="Variação">{formatDelta(entrada.variacao ?? null)}</CardMetrica>
                  </div>

                  {areas.length > 0 ? (
                    <div className="space-y-2">
                      <TituloSecao>Acerto por grande área · neste simulado</TituloSecao>
                      <div className="flex flex-col gap-2">
                        {areas.map((area) => (
                          <BarraArea
                            key={area.area}
                            area={area.area}
                            acertoPct={area.acertoPct}
                            critica={area.critica}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {areaCritica ? (
                    <div
                      data-testid={`drawer-area-critica-${entrada.simuladoId}`}
                      style={{
                        border: '1px solid var(--gp-danger-surface)',
                        background: 'var(--gp-danger-surface)',
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--gp-danger-on)',
                        }}
                      >
                        Grande área crítica
                      </div>
                      {/* Sem "foco sugerido": a recomendação da referência
                          depende de dado que `get_gestor_aluno` não devolve —
                          e inventar recomendação é pior que não ter. */}
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gp-text-1)', marginTop: 4 }}>
                        {`${areaCritica.area} · ${formatPct(areaCritica.acertoPct)} de acerto`}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {/*
          Rodapé de ações via `AcoesRecorte` (mesmo componente do DrawerTemas),
          NUNCA botões locais: é ele quem aplica o gate de `podeExportar` —
          capability resolvida no SERVIDOR (`get_gestor_contexto`), nunca role
          lida no cliente. Sem a capability, as duas ações ficam ausentes, não
          desabilitadas.
        */}
        <div className="flex flex-wrap gap-2 pt-3.5" style={{ borderTop: '1px solid var(--gp-border-subtle)' }}>
          <AcoesRecorte escopo={nomeExibido} resumoTexto={resumoTexto} onExportar={exportar} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
