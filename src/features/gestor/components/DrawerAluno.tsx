import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AcoesRecorte } from '@/features/gestor/components/AcoesRecorte';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { FONTE_MONO, TagSituacao } from '@/features/gestor/components/tabela';
import { useAluno, useAlunoContato, useAlunoDesempenhoPorArea } from '@/features/gestor/api/queries';
import { baixarCsv, nomeArquivoCsv, type ColunaCsv } from '@/features/gestor/lib/exportarCsv';
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
import { supabase } from '@/integrations/supabase/client';
import type { AlunoSimuladoEntry } from '@/features/gestor/api/types';
import type { AreaDesempenhoAluno, DesempenhoPorAreaSimulado } from '@/features/gestor/api/types-aluno-area';

/**
 * Colunas do CSV do recorte do aluno: uma linha por SIMULADO, a mesma série
 * cronológica que a tela desenha. Célula vazia onde a tela mostra `—` (nota
 * ainda não processada) — nunca zero, que afirmaria um desempenho que ninguém
 * mediu.
 *
 * Decimal com vírgula e sem sufixo de unidade: com "%" ou ponto decimal o
 * Excel em pt-BR importa a coluna como texto e nenhuma média funciona depois.
 */
const COLUNAS_ALUNO: ReadonlyArray<ColunaCsv<AlunoSimuladoEntry>> = [
  { cabecalho: 'Simulado', valor: (entrada) => entrada.simuladoNome },
  { cabecalho: 'Data', valor: (entrada) => formatData(entrada.simuladoData) },
  { cabecalho: 'Participou', valor: (entrada) => (entrada.participou ? 'sim' : 'não') },
  {
    cabecalho: 'Proficiência',
    valor: (entrada) => (entrada.proficiencia === null ? '' : String(entrada.proficiencia).replace('.', ',')),
  },
  { cabecalho: 'Acertos', valor: (entrada) => (entrada.acertos === null ? '' : entrada.acertos) },
  { cabecalho: 'Situação', valor: (entrada) => rotuloSituacao(entrada.situacao) },
];


export interface DrawerAlunoProps {
  alunoId: string | null;
  nome: string;
  /** Ids dos simulados em foco no recorte — vão direto para `useAluno`. */
  simulados: string[];
  onFechar: () => void;
  /**
   * Exportação do recorte do aluno. Opcional e, desde a auditoria de 09/08,
   * apenas um OVERRIDE: sem callback o próprio drawer gera o CSV local (uma
   * linha por simulado, os mesmos números da tela) e confirma por toast.
   * Passe `onExportar` quando a tela quiser tratar o clique (telemetria
   * própria, escopo diferente, export no servidor com a auditoria do §7.7).
   */

  onExportar?: (escopo: string) => void;
}

/**
 * DDI do Brasil para o link `wa.me`. Os telefones de `public.users.telefone`
 * são cadastrados com DDD e sem DDI (ex.: `11988887777`), e o `wa.me` exige o
 * número internacional completo. Só é prefixado quando o número já não vem
 * com ele — ver `linkWhatsAppAluno`.
 */
const LINK_WHATSAPP_DDI = '55';

/**
 * Link `wa.me` para o telefone do aluno, com o resumo do recorte já no texto.
 *
 * Devolve `null` para telefone ausente ou que não sobrou número nenhum depois
 * de limpar a máscara — um "falar no WhatsApp" que abre uma conversa vazia é
 * pior que a ausência do botão. O DDI só entra quando falta: números
 * cadastrados com `55` na frente (acontece) virariam `5555…` se prefixados
 * sem checar. O teto de 11 dígitos é o do telefone nacional (DDD + 9 dígitos),
 * que é o formato de `public.users.telefone`.
 */
export function linkWhatsAppAluno(telefone: string | null | undefined, texto: string): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  if (digitos.length === 0) return null;
  const numero = digitos.length <= 11 ? `${LINK_WHATSAPP_DDI}${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * `dd/MM` a partir dos dígitos do ISO — mesmo cuidado de `formatData`: nunca
 * instanciar `Date` a partir da string, porque `new Date('2026-03-10')` é
 * meia-noite UTC e, em UTC-3, viraria 09/03.
 */
export function formatDataCurta(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return TRACO;
  const [, , mes, dia] = match;
  return `${dia}/${mes}`;
}

/** Iniciais do avatar: primeira letra do primeiro e do último nome. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return TRACO;
  const primeira = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}

interface PontoEvolucao {
  rotulo: string;
  valor: number;
  data: string;
}

/**
 * Evolução da proficiência do aluno (docs/06 §6) — o gráfico PROTAGONISTA do
 * drawer, não um fio de cabelo no canto.
 *
 * A versão anterior era uma sparkline de 76px de altura, sem valor, sem data
 * e sem hierarquia entre os pontos: dava para ver que subiu, não QUANTO nem
 * QUANDO, e ela era justamente o único lugar do drawer onde a leitura é "este
 * aluno está melhorando?". Aqui ela ganha a mesma anatomia do gráfico
 * institucional (`charts/EvolucaoChart.tsx`), na escala do painel: área em
 * gradiente sob a linha, meta tracejada rotulada, valor sobre cada ponto,
 * data sob cada ponto, e o ponto CORRENTE com halo + anel + miolo, enquanto
 * os anteriores são círculos brancos de anel fino.
 *
 * Só pontos MEDIDOS entram: simulado sem nota fica fora da série, nunca vira
 * zero nem interpolação entre vizinhos. Com menos de dois pontos não há
 * evolução para desenhar e o bloco inteiro não é renderizado pelo chamador.
 *
 * SVG à mão, sem Recharts: são 2 a 5 pontos num painel de largura fixa, e o
 * drawer não paga o custo de montar um `ResponsiveContainer` para isso.
 */
function EvolucaoAluno({ pontos }: { pontos: PontoEvolucao[] }) {
  const LARGURA = 348;
  const ALTURA = 148;
  /** Faixa vertical do plot. O respiro de cima é onde moram os valores. */
  const TOPO = 30;
  const BASE = 108;
  const MARGEM_X = 26;

  const y = (valor: number) => BASE - (valor / 100) * (BASE - TOPO);
  const x = (i: number) =>
    pontos.length === 1
      ? LARGURA / 2
      : MARGEM_X + (i * (LARGURA - MARGEM_X * 2)) / (pontos.length - 1);

  const ultimo = pontos.length - 1;
  const vertices = pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ');
  const areaSobALinha = `${x(0)},${BASE} ${vertices} ${x(ultimo)},${BASE}`;
  const descricao = pontos
    .map((p, i) => `${i + 1}º simulado (${p.rotulo}): ${formatNumero(p.valor)}`)
    .join('; ');


  return (
    <svg
      role="img"
      aria-label={`Evolução de proficiência — ${descricao}`}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* Sem `<title>`: com `role="img"` + `aria-label` ele não acrescenta
          nada à árvore de acessibilidade e vira tooltip nativo do navegador
          por cima do próprio gráfico — mesma razão registrada em
          `charts/EvolucaoChart.tsx`. */}
      <defs>
        <linearGradient id="gradiente-evolucao-aluno" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gp-brand)" stopOpacity={0.2} />
          <stop offset="70%" stopColor="var(--gp-brand)" stopOpacity={0.04} />
          <stop offset="100%" stopColor="var(--gp-brand)" stopOpacity={0} />
        </linearGradient>
      </defs>

      <polygon points={areaSobALinha} fill="url(#gradiente-evolucao-aluno)" />

      <line
        x1={8}
        y1={y(PROFICIENCIA_MINIMA)}
        x2={LARGURA - 8}
        y2={y(PROFICIENCIA_MINIMA)}
        stroke="var(--gp-border-input)"
        strokeWidth={1.2}
        strokeDasharray="5 4"
      />
      <text
        x={LARGURA - 8}
        y={y(PROFICIENCIA_MINIMA) - 5}
        fontSize={9}
        fill="var(--gp-text-3)"
        textAnchor="end"
        fontFamily={FONTE_MONO}
      >
        {`meta ${PROFICIENCIA_MINIMA}`}
      </text>

      <polyline
        points={vertices}
        fill="none"
        stroke="var(--gp-brand)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {pontos.map((ponto, i) => {
        const ehUltimo = i === ultimo;
        return (
          <g key={`${ponto.rotulo}-${ponto.data}`}>
            {ehUltimo ? (
              <>
                <circle cx={x(i)} cy={y(ponto.valor)} r={12} fill="var(--gp-brand)" opacity={0.14} />
                <circle
                  cx={x(i)}
                  cy={y(ponto.valor)}
                  r={6.5}
                  fill="var(--gp-surface-1)"
                  stroke="var(--gp-brand)"
                  strokeWidth={2.2}
                />
                <circle cx={x(i)} cy={y(ponto.valor)} r={3.2} fill="var(--gp-brand)" />
              </>
            ) : (
              <circle
                cx={x(i)}
                cy={y(ponto.valor)}
                r={5}
                fill="var(--gp-surface-1)"
                stroke="var(--gp-brand)"
                strokeWidth={1.6}
              />
            )}
            {/* Valor acima do ponto: sem eixo Y, é o único jeito de saber
                QUANTO — a leitura que a sparkline anterior não entregava. */}
            <text
              x={x(i)}
              y={y(ponto.valor) - 14}
              fontSize={11}
              fontWeight={ehUltimo ? 700 : 600}
              fill={ehUltimo ? 'var(--gp-brand-on-dark)' : 'var(--gp-text-2)'}
              textAnchor="middle"
              fontFamily={FONTE_MONO}
            >
              {formatNumero(ponto.valor)}
            </text>
            {/* Ordem do simulado sob o ponto, no lugar de um eixo X de datas:
                as datas de aplicação por aluno confundiam a leitura, então o
                eixo passa a ser "1º simulado", "2º simulado"… na sequência dos
                simulados que ESTE aluno fez. Forma compacta com 4+ pontos,
                senão o rótulo não cabe na coluna. */}
            <text
              x={x(i)}
              y={ALTURA - 12}
              fontSize={9}
              fill="var(--gp-text-3)"
              textAnchor="middle"
              fontFamily={FONTE_MONO}
            >
              {pontos.length > 3 ? `${i + 1}º sim.` : `${i + 1}º simulado`}
            </text>

          </g>
        );
      })}
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

/*
 * `BarraArea` foi removida em 09/08: o comparativo de barras por grande área
 * deixou de ser um bloco próprio e virou o nível 1 da cascata única
 * (`BarraNivel`, abaixo), que desenha a mesma barra + % nos três níveis.
 */


/**
 * Uma linha da lista "Notas dos simulados".
 *
 * Substitui o cartão de meia tela por simulado que o drawer tinha antes
 * (quatro caixas de métrica + barras de área + bloco de crítica, REPETIDOS a
 * cada simulado): num aluno com 4 simulados, era preciso rolar quatro telas
 * para responder "como ele foi indo". A referência resolve com uma lista —
 * nome à esquerda, nota à direita — e é dela que sai a leitura de relance.
 *
 * Nada foi perdido no caminho: acertos, posição, percentil e variação, que
 * viviam nas caixas, seguem na linha de apoio. Nenhum número é somado ou
 * mediado entre simulados (regra de agregação honesta do handoff).
 */
function LinhaSimulado({ entrada }: { entrada: AlunoSimuladoEntry }) {
  const apoio = [
    formatData(entrada.simuladoData),
    entrada.acertos === null ? null : `${formatNumero(entrada.acertos)} acertos`,
    entrada.posicao
      ? `${entrada.posicao.lugar}º de ${entrada.posicao.total} · percentil ${entrada.posicao.percentil}`
      : null,
    entrada.variacao === null || entrada.variacao === undefined
      ? null
      : `${formatDelta(entrada.variacao)} vs anterior`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li
      data-testid={`drawer-simulado-${entrada.simuladoId}`}
      className="flex items-start justify-between gap-3 py-2.5"
    >
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--gp-text-1)' }}>
          {entrada.simuladoNome}
        </p>
        <p style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>{apoio}</p>
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        <span
          data-testid={`drawer-proficiencia-${entrada.simuladoId}`}
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--gp-text-1)',
            fontFamily: FONTE_MONO,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {formatNumero(entrada.proficiencia)}
        </span>
        <TagSituacao situacao={entrada.situacao} />
      </div>
    </li>
  );
}

/**
 * O insight de grande área do drawer.
 *
 * A referência fecha o painel com um bloco que NOMEIA uma área — é o que
 * transforma quatro barras num próximo passo. A regra de escolha:
 *
 * 1. Existe área crítica? É dela que se fala, em tinta de perigo. Entre duas
 *    críticas, a de menor acerto — "comece pela pior" é o mesmo conselho que
 *    o Diagnóstico Curricular dá no macro.
 * 2. Não existe? Então o insight é o DESTAQUE (maior acerto), com a menor
 *    citada na mesma frase. Sem área crítica, silenciar seria devolver quatro
 *    barras e nenhuma leitura.
 *
 * O "Foco sugerido: Neonatologia — ictericia e hipoglicemia concentram 70%
 * dos erros" da referência continua fora: depende de erro por TEMA do aluno,
 * que `get_gestor_aluno` não devolve. Recomendação inventada é pior que
 * recomendação ausente (§4.10).
 */
function InsightArea({
  areas,
  simuladoId,
}: {
  areas: NonNullable<AlunoSimuladoEntry['acertoPorArea']>;
  simuladoId: string;
}) {
  const criticas = areas.filter((area) => area.critica);

  if (criticas.length > 0) {
    const pior = criticas.reduce((menor, area) => (area.acertoPct < menor.acertoPct ? area : menor));
    return (
      <div
        data-testid={`drawer-area-critica-${simuladoId}`}
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
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gp-text-1)', marginTop: 4 }}>
          {`${pior.area} · ${formatPct(pior.acertoPct)} de acerto`}
        </div>
      </div>
    );
  }

  const ordenadas = [...areas].sort((a, b) => b.acertoPct - a.acertoPct);
  const melhor = ordenadas[0];
  const menor = ordenadas[ordenadas.length - 1];

  return (
    <div
      data-testid={`drawer-area-destaque-${simuladoId}`}
      style={{
        border: '1px solid var(--gp-success-surface)',
        background: 'var(--gp-success-surface)',
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
          color: 'var(--gp-success-on)',
        }}
      >
        Destaque do aluno
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gp-text-1)', marginTop: 4 }}>
        {`${melhor.area} · ${formatPct(melhor.acertoPct)} de acerto`}
      </div>
      {melhor.area !== menor.area ? (
        <div style={{ fontSize: 11, color: 'var(--gp-text-2)', marginTop: 4 }}>
          {`Menor acerto: ${menor.area} · ${formatPct(menor.acertoPct)} — nenhuma área abaixo do corte de área crítica.`}
        </div>
      ) : null}
    </div>
  );
}

/** Uma especialidade agrupada, com os temas já ordenados do pior para o melhor acerto. */
interface EspecialidadeAgrupada {
  especialidade: string;
  temas: AreaDesempenhoAluno[];
  /** % de acerto ponderado pelas questões respondidas dos temas. `null` sem questão respondida. */
  acertoPct: number | null;
  criticos: number;
}

/** Uma grande área agrupada, com as especialidades e o % de acerto do nível. */
interface GrandeAreaAgrupada {
  grandeArea: string;
  especialidades: EspecialidadeAgrupada[];
  acertoPct: number | null;
  totalTemas: number;
  totalCriticos: number;
}

/**
 * % de acerto de um conjunto de temas — ponderado pelas questões RESPONDIDAS,
 * nunca média simples dos percentuais (que daria peso igual a um tema de 1
 * questão e a outro de 20). Sem questão respondida, `null`: a UI mostra TRAÇO
 * em vez de inventar zero (§4.10).
 */
function acertoPonderado(temas: AreaDesempenhoAluno[]): number | null {
  let acertos = 0;
  let respondidas = 0;
  for (const tema of temas) {
    if (tema.questoesRespondidas <= 0) continue;
    acertos += (tema.acertoPct / 100) * tema.questoesRespondidas;
    respondidas += tema.questoesRespondidas;
  }
  return respondidas === 0 ? null : (acertos / respondidas) * 100;
}

/**
 * Agrupa as linhas de tema (a granularidade que `get_gestor_aluno_desempenho_por_area`
 * devolve) em grande área → especialidade → tema para o drill-down.
 *
 * Cada nível carrega o SEU % de acerto, ponderado pelas questões respondidas
 * dos temas que estão abaixo dele — a conta que a própria RPC faria, não uma
 * média de percentuais. Quando o payload de `acertoPorArea` do simulado traz o
 * % da grande área, é ELE que prevalece no nível 1 (`acertoOficialPorArea`):
 * número da RPC ganha de número recalculado.
 *
 * Temas dentro de uma especialidade saem ordenados do PIOR para o melhor
 * acerto — "comece pela pior", mesmo critério de `DiagnosticoCriticoVazio`.
 * Especialidades e grandes áreas também: agora existe um número por nível
 * para ordenar por severidade.
 */
function agruparPorArea(
  areas: AreaDesempenhoAluno[],
  acertoOficialPorArea?: Map<string, number>,
): GrandeAreaAgrupada[] {
  const porGrandeArea = new Map<string, Map<string, AreaDesempenhoAluno[]>>();

  for (const area of areas) {
    if (!porGrandeArea.has(area.grandeArea)) porGrandeArea.set(area.grandeArea, new Map());
    const porEspecialidade = porGrandeArea.get(area.grandeArea)!;
    if (!porEspecialidade.has(area.especialidade)) porEspecialidade.set(area.especialidade, []);
    porEspecialidade.get(area.especialidade)!.push(area);
  }

  const ordenarPorAcerto = <T extends { acertoPct: number | null }>(a: T, b: T) =>
    (a.acertoPct ?? 101) - (b.acertoPct ?? 101);

  return [...porGrandeArea.entries()]
    .map(([grandeArea, especialidadesMapa]) => {
      const especialidades: EspecialidadeAgrupada[] = [...especialidadesMapa.entries()]
        .map(([especialidade, temas]) => {
          const ordenados = [...temas].sort((a, b) => a.acertoPct - b.acertoPct);
          return {
            especialidade,
            temas: ordenados,
            acertoPct: acertoPonderado(ordenados),
            criticos: ordenados.filter((t) => t.critica).length,
          };
        })
        .sort(ordenarPorAcerto);

      const todosOsTemas = especialidades.flatMap((e) => e.temas);
      const oficial = acertoOficialPorArea?.get(grandeArea);

      return {
        grandeArea,
        especialidades,
        acertoPct: oficial ?? acertoPonderado(todosOsTemas),
        totalTemas: todosOsTemas.length,
        totalCriticos: todosOsTemas.filter((t) => t.critica).length,
      };
    })
    .sort(ordenarPorAcerto);
}

/**
 * Funde as linhas de tema de VÁRIOS simulados numa lista única — a visão
 * consolidada do bloco "Desempenho por área" (decisão de produto, 11/08).
 *
 * A chave é `grandeArea|especialidade|tema`. O % de cada tema é média
 * **ponderada pelas questões respondidas**, nunca média de percentuais: soma
 * de acertos sobre soma de respondidas. Simulado em que o tema não foi cobrado
 * simplesmente não entra (nada de zero imaginário, §4.10); tema que só existe
 * em um simulado aparece com o dado que existe.
 *
 * `critica` fica true se o tema estava crítico em ALGUM dos simulados — não se
 * inventa baseline novo para o recorte agregado.
 */
export function consolidarAreas(entradas: DesempenhoPorAreaSimulado[]): AreaDesempenhoAluno[] {
  const acumulado = new Map<
    string,
    { linha: AreaDesempenhoAluno; acertos: number; respondidas: number; total: number }
  >();

  for (const entrada of entradas) {
    for (const area of entrada.areas) {
      if (area.questoesRespondidas <= 0) continue;
      const chave = `${area.grandeArea}|${area.especialidade}|${area.tema}`;
      const atual = acumulado.get(chave);
      if (!atual) {
        acumulado.set(chave, {
          linha: { ...area },
          acertos: (area.acertoPct / 100) * area.questoesRespondidas,
          respondidas: area.questoesRespondidas,
          total: area.questoesTotal,
        });
        continue;
      }
      atual.acertos += (area.acertoPct / 100) * area.questoesRespondidas;
      atual.respondidas += area.questoesRespondidas;
      atual.total += area.questoesTotal;
      atual.linha.critica = atual.linha.critica || area.critica;
    }
  }

  return [...acumulado.values()].map(({ linha, acertos, respondidas, total }) => ({
    ...linha,
    questoesRespondidas: respondidas,
    questoesTotal: total,
    acertoPct: (acertos / respondidas) * 100,
  }));
}

/**
 * Barra + % de um nível da cascata. É a MESMA leitura em todos os três níveis
 * (grande área, especialidade, tema) — o que muda é só a escala tipográfica e
 * o recuo, para que a granularidade se leia sem trocar de vocabulário visual.
 */
function BarraNivel({
  rotulo,
  acertoPct,
  critica,
  peso,
  tamanho,
}: {
  rotulo: string;
  acertoPct: number | null;
  critica: boolean;
  peso: number;
  tamanho: number;
}) {
  const cor = critica ? 'var(--gp-danger-on)' : 'var(--gp-text-2)';
  return (
    <>
      <span
        className="min-w-0 flex-1 truncate"
        style={{ fontSize: tamanho, fontWeight: peso, color: critica ? cor : 'var(--gp-text-1)' }}
      >
        {rotulo}
        {/* Cor nunca é canal único: a criticidade também sai por texto. */}
        {critica ? <span className="sr-only"> (crítico)</span> : null}
      </span>
      <span
        role="progressbar"
        aria-label={`Percentual de acerto em ${rotulo}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={acertoPct === null ? undefined : Math.round(acertoPct)}
        style={{
          width: 88,
          flex: 'none',
          height: 6,
          background: 'var(--gp-surface-3)',
          borderRadius: 'var(--gp-radius-pill)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${acertoPct ?? 0}%`,
            height: '100%',
            background: critica ? 'var(--gp-danger)' : 'var(--gp-text-1)',
            borderRadius: 'var(--gp-radius-pill)',
          }}
        />
      </span>
      <span
        style={{
          fontFamily: FONTE_MONO,
          fontSize: tamanho,
          fontWeight: 600,
          width: 36,
          flex: 'none',
          textAlign: 'right',
          color: critica ? cor : 'var(--gp-text-1)',
        }}
      >
        {acertoPct === null ? TRACO : formatPct(acertoPct)}
      </span>
    </>
  );
}

/** Nível 3 (folha) do drill-down: o tema, sempre com o seu % de acerto. */
function LinhaTema({ tema }: { tema: AreaDesempenhoAluno }) {
  return (
    <li
      data-testid={`drawer-tema-${tema.tema}`}
      className="flex items-center gap-2 py-1.5 pl-2 pr-2"
    >
      <BarraNivel
        rotulo={tema.tema}
        acertoPct={tema.acertoPct}
        critica={tema.critica}
        peso={400}
        tamanho={11}
      />
    </li>
  );
}

/** Nível 2 do drill-down: a especialidade, com o seu % e expandindo nos temas. */
function LinhaEspecialidade({
  grupo,
  aberto,
  onClick,
}: {
  grupo: EspecialidadeAgrupada;
  aberto: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-especialidade-cascata=""
        onClick={onClick}
        aria-expanded={aberto}
        data-testid={`drawer-especialidade-${grupo.especialidade}`}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon
          name={aberto ? 'expand_more' : 'chevron_right'}
          variant="outlined"
          size={14}
          box={14}
          className={aberto ? 'text-foreground' : 'text-muted-foreground'}
        />
        <BarraNivel
          rotulo={grupo.especialidade}
          acertoPct={grupo.acertoPct}
          critica={grupo.criticos > 0}
          peso={600}
          tamanho={12}
        />
      </button>
      {aberto ? (
        <ul
          data-testid={`drawer-temas-de-${grupo.especialidade}`}
          className="ml-4 border-l pl-1"
          style={{ borderColor: 'var(--gp-border-subtle)' }}
        >
          {grupo.temas.map((tema) => (
            <LinhaTema key={tema.tema} tema={tema} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Cascata ÚNICA de desempenho do aluno: grande área → especialidade → tema,
 * com % de acerto em TODOS os níveis (decisão de produto, 09/08).
 *
 * Antes eram dois blocos: um comparativo de barras por grande área e, logo
 * abaixo, uma cascata que só contava temas e temas críticos. O gestor lia o
 * mesmo assunto duas vezes e, ao abrir a granularidade, PERDIA a métrica que
 * viera no bloco de cima. Agora é um só: a barra e o % acompanham cada nível,
 * e a granularidade é revelada pela interação, nunca por outro bloco.
 *
 * Acordeão de UM aberto por nível — clicar outra grande área fecha a
 * especialidade aberta na anterior, mesma exclusividade da cascata do
 * Diagnóstico.
 */
function CascataDesempenhoAluno({
  areas,
  acertoOficialPorArea,
}: {
  areas: AreaDesempenhoAluno[];
  acertoOficialPorArea?: Map<string, number>;
}) {
  const grupos = React.useMemo(
    () => agruparPorArea(areas, acertoOficialPorArea),
    [areas, acertoOficialPorArea],
  );
  const [grandeAreaAberta, setGrandeAreaAberta] = React.useState<string | null>(null);
  const [especialidadeAberta, setEspecialidadeAberta] = React.useState<string | null>(null);

  const alternarGrandeArea = (grandeArea: string) => {
    setGrandeAreaAberta((atual) => (atual === grandeArea ? null : grandeArea));
    setEspecialidadeAberta(null);
  };

  return (
    <ul data-testid="drawer-cascata-areas" className="space-y-0.5">
      {grupos.map((grupo) => {
        const aberto = grandeAreaAberta === grupo.grandeArea;
        return (
          <li key={grupo.grandeArea}>
            <button
              type="button"
              data-grande-area-cascata=""
              onClick={() => alternarGrandeArea(grupo.grandeArea)}
              aria-expanded={aberto}
              data-testid={`drawer-grande-area-${grupo.grandeArea}`}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon
                name={aberto ? 'expand_more' : 'chevron_right'}
                variant="outlined"
                size={16}
                box={16}
                className={aberto ? 'text-foreground' : 'text-muted-foreground'}
              />
              <BarraNivel
                rotulo={grupo.grandeArea}
                acertoPct={grupo.acertoPct}
                critica={grupo.totalCriticos > 0}
                peso={700}
                tamanho={13}
              />
            </button>
            {aberto ? (
              <ul
                data-testid={`drawer-especialidades-de-${grupo.grandeArea}`}
                className="ml-4 border-l pl-1"
                style={{ borderColor: 'var(--gp-border-subtle)' }}
              >
                {grupo.especialidades.map((especialidade) => (
                  <LinhaEspecialidade
                    key={especialidade.especialidade}
                    grupo={especialidade}
                    aberto={especialidadeAberta === especialidade.especialidade}
                    onClick={() =>
                      setEspecialidadeAberta((atual) =>
                        atual === especialidade.especialidade ? null : especialidade.especialidade,
                      )
                    }
                  />
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}


/**
 * Ocultado por decisão de produto em 09/08 — a RPC/edge function seguem no ar
 * em produção, só a entrada de UI foi desligada enquanto o insight por IA não
 * é revisado. Reativar trocando para `true` (ver também `BlocoInsights.tsx`).
 */
const MOSTRAR_INSIGHT_IA = false;

interface InsightAlunoIAProps {
  iesId: string | null;
  alunoId: string;
  simulados: string[];
}

/**
 * "Insight do aluno" gerado por IA (edge function `gestor-ai-insights`, spec
 * da task 09/08). Mesmo padrão de chamada de `AiRecommendationCard.tsx`
 * (`supabase.functions.invoke`), adaptado à anatomia do gestor (skeleton do
 * portal, `TituloSecao`) em vez dos componentes genéricos daquele cartão.
 *
 * Sob CLIQUE do usuário, nunca ao abrir o drawer — decisão de custo já
 * tomada. Qualquer falha (status != 200, exceção de rede, resposta sem
 * `insight` utilizável) esconde o resultado e cai num estado de erro
 * discreto com "Tentar novamente": a IA nunca trava nem quebra o resto do
 * drawer, mesmo princípio de degradação graciosa do cartão de referência.
 */
function InsightAlunoIA({ iesId, alunoId, simulados }: InsightAlunoIAProps) {
  const [estado, setEstado] = React.useState<'ocioso' | 'carregando' | 'ok' | 'erro'>('ocioso');
  const [insight, setInsight] = React.useState<string | null>(null);

  const gerar = React.useCallback(async () => {
    setEstado('carregando');
    try {
      const { data, error } = await supabase.functions.invoke('gestor-ai-insights', {
        body: { modo: 'aluno', iesId, alunoId, simulados },
      });
      if (error) throw error;
      const texto = typeof data?.insight === 'string' ? data.insight.trim() : '';
      if (!texto) throw new Error('gestor-ai-insights: resposta sem insight');
      setInsight(texto);
      setEstado('ok');
    } catch {
      // Degradação graciosa: nunca deixa a exceção subir e derrubar o resto
      // do drawer — só recolhe o resultado e mostra o estado de erro local.
      setInsight(null);
      setEstado('erro');
    }
  }, [iesId, alunoId, simulados]);

  const rotuloBotao =
    estado === 'carregando'
      ? 'Gerando…'
      : estado === 'erro'
        ? 'Tentar novamente'
        : estado === 'ok'
          ? 'Gerar novamente'
          : 'Gerar com IA';

  return (
    <div data-testid="drawer-insight-ia" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <TituloSecao>Insight do aluno (IA)</TituloSecao>
        <Button
          variant="outline"
          size="sm"
          data-testid="drawer-insight-ia-gerar"
          className="h-auto shrink-0 rounded-sm px-3 py-1.5 text-xs font-semibold"
          onClick={gerar}
          disabled={estado === 'carregando'}
        >
          {rotuloBotao}
        </Button>
      </div>

      {estado === 'carregando' ? (
        <div className="space-y-1.5" data-testid="drawer-insight-ia-carregando">
          <GestorSkeleton altura={12} rotulo="Gerando insight do aluno" />
          <GestorSkeleton altura={12} rotulo="Gerando insight do aluno" />
          <GestorSkeleton altura={12} rotulo="Gerando insight do aluno" />
        </div>
      ) : estado === 'erro' ? (
        <p data-testid="drawer-insight-ia-erro" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
          Não foi possível gerar o insight agora.
        </p>
      ) : estado === 'ok' && insight ? (
        <p
          data-testid="drawer-insight-ia-texto"
          style={{ fontSize: 13, color: 'var(--gp-text-1)', lineHeight: 1.5 }}
        >
          {insight}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Corpo do drawer em carregamento (spec de motion §5, item 7 — "Drawer /
 * painel"): não mais dois blocos genéricos do mesmo tamanho, e sim uma grade
 * 2×2 de cartões (posto no lugar dos cartões de "Notas dos simulados" que o
 * corpo real mostra primeiro) seguida de um bloco de barras (posto no lugar
 * da evolução/comparativo/desempenho por área que vêm depois na rolagem). O
 * cabeçalho (avatar + nome) já é real — segue montado fora deste bloco.
 */
function CorpoAlunoSkeleton() {
  const rotulo = 'Carregando dados do aluno';
  return (
    <div className="flex-1 space-y-4" data-testid="drawer-aluno-skeleton">
      <div className="grid grid-cols-2 gap-3">
        <GestorSkeleton forma="cartao" altura={96} rotulo={rotulo} />
        <GestorSkeleton forma="cartao" altura={96} rotulo={rotulo} />
        <GestorSkeleton forma="cartao" altura={96} rotulo={rotulo} />
        <GestorSkeleton forma="cartao" altura={96} rotulo={rotulo} />
      </div>
      <div className="space-y-2">
        <GestorSkeleton altura={40} rotulo={rotulo} />
        <GestorSkeleton altura={40} rotulo={rotulo} />
        <GestorSkeleton altura={40} rotulo={rotulo} />
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
  const desempenhoArea = useAlunoDesempenhoPorArea(alunoId, simulados);
  const { iesId } = useFiltrosGestor();
  /**
   * Regra dos 400ms (spec de motion §7): abaixo disso, nada de skeleton — o
   * corpo fica em branco por uma fração de segundo em vez de piscar um
   * carregamento que a rede já resolveu.
   */
  const mostrarSkeleton = useDelayedLoading(consulta.isLoading);
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

  /**
   * Simulado escolhido para a seção "Desempenho por área" (achado 11/08).
   *
   * O bloco de área SEMPRE fala de UM simulado (nunca fundido — regra de
   * agregação honesta), mas até aqui esse simulado era imposto: o mais recente
   * com classificação por área, ainda que fosse um simulado sem nota TRI
   * liberada. Resultado real em produção: selo "Proficiente 80,3" (1º simulado)
   * no topo e barras de 0–28% (3º simulado, resultado em processamento)
   * embaixo, sem nada dizendo que eram simulados diferentes.
   *
   * O par `{ aluno, simulado }` no estado é o que dispensa `useEffect` de
   * reset: se o `alunoId` do estado não é o aluno em tela, a escolha não vale
   * e o padrão volta a decidir.
   */
  const [areaEscolhida, setAreaEscolhida] = React.useState<{
    aluno: string;
    /** `'todos'` = visão consolidada (padrão); um id = simulado individual. */
    simulado: string | 'todos';
  } | null>(null);

  if (!alunoId) return null;


  const semestre = entradas[0]?.semestre ?? null;

  /**
   * Cobertura do recorte = PARTICIPAÇÃO, não pertencimento (achado 11/08).
   *
   * `entradas` traz uma linha por simulado do recorte SEMPRE, inclusive para
   * quem não fez (`participou: false`, métricas null) — então contar entradas
   * imprimia "3 de 3 simulados" para uma aluna que fez 2, e o mesmo "3 de 3"
   * para quem não fez nenhum. O numerador agora é quem realmente participou; o
   * denominador continua sendo o recorte pedido pela tela (`simulados`), para a
   * fração se fechar sozinha.
   */
  const noRecorte = new Set(simulados);
  const cobertos = entradas.filter((e) => noRecorte.has(e.simuladoId) && e.participou).length;
  const contexto = [
    `${semestre === null ? TRACO : `${semestre}º`} período`,
    simulados.length === 0
      ? null
      : `participou de ${cobertos} de ${simulados.length} ${simulados.length === 1 ? 'simulado' : 'simulados'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  /** Ordem cronológica para a série — a RPC já devolve assim, mas não custa garantir. */
  const cronologicas = [...entradas].sort((a, b) => a.simuladoData.localeCompare(b.simuladoData));
  const pontos: PontoEvolucao[] = cronologicas
    .filter((e): e is AlunoSimuladoEntry & { proficiencia: number } => e.proficiencia !== null)
    .map((e) => ({ rotulo: e.simuladoNome, valor: e.proficiencia, data: e.simuladoData }));

  /**
   * Bloco "Desempenho por área": DUAS leituras possíveis (decisão de produto,
   * 11/08).
   *
   * - **Consolidado (padrão)**: junta os simulados que o aluno fez e mostra o %
   *   médio ponderado pelas questões respondidas (`consolidarAreas`). É a
   *   leitura pedida por quem quer o retrato acumulado do aluno.
   * - **Individual**: um simulado por vez, exatamente como antes — com a tag de
   *   "resultado em processamento" e o aviso de divergência de proficiência.
   *
   * `.reverse()` sobre uma CÓPIA — `cronologicas` já é cópia de `entradas`,
   * mas reverter no lugar mudaria a ordem da lista de notas e da série.
   */
  const areaPorSimulado = new Map(
    (desempenhoArea.data ?? []).map((entrada) => [entrada.simuladoId, entrada]),
  );
  const candidatasAreas = cronologicas.filter(
    (e) => (e.acertoPorArea ?? []).length > 0 || (areaPorSimulado.get(e.simuladoId)?.areas.length ?? 0) > 0,
  );
  /** Só as entradas com classificação por tema entram no consolidado. */
  const entradasComTemas = candidatasAreas
    .map((e) => areaPorSimulado.get(e.simuladoId))
    .filter((e): e is DesempenhoPorAreaSimulado => Boolean(e && e.areas.length > 0));
  const podeConsolidar = entradasComTemas.length > 0;

  const escolha =
    areaEscolhida && areaEscolhida.aluno === alunoId
      ? areaEscolhida.simulado
      : podeConsolidar
        ? 'todos'
        : null;
  const modoTodos = escolha === 'todos' && podeConsolidar;

  const maisRecentes = [...candidatasAreas].reverse();
  const padraoAreas = maisRecentes.find((e) => e.proficiencia !== null) ?? maisRecentes[0] ?? null;
  const escolhida =
    escolha && escolha !== 'todos'
      ? candidatasAreas.find((e) => e.simuladoId === escolha) ?? null
      : null;
  /** No consolidado NÃO existe "o simulado do bloco" — por isso null. */
  const entradaDasAreas = modoTodos ? null : escolhida ?? padraoAreas;
  const areasDoAluno = [...(entradaDasAreas?.acertoPorArea ?? [])].sort(
    (a, b) => b.acertoPct - a.acertoPct,
  );

  /** Quantos simulados feitos ficaram fora do consolidado por falta de classificação. */
  const participados = cronologicas.filter((e) => e.participou).length;
  const foraDoConsolidado = Math.max(participados - entradasComTemas.length, 0);

  /**
   * Drill-down por tema: no consolidado é a fusão ponderada; no individual, o
   * MESMO simulado do bloco acima, casado por `simuladoId`.
   */
  const entradaAreaDetalhada: DesempenhoPorAreaSimulado | null = modoTodos
    ? { simuladoId: 'todos', nome: 'Todos os simulados', areas: consolidarAreas(entradasComTemas) }
    : (entradaDasAreas ? areaPorSimulado.get(entradaDasAreas.simuladoId) : undefined) ?? null;

  /**
   * Simulado que originou a proficiência exibida no topo (o mais recente com
   * nota). Quando não é o mesmo do bloco de área, a tela diz isso em uma
   * frase. No consolidado o aviso não se aplica.
   */
  const entradaDaProficiencia = [...cronologicas].reverse().find((e) => e.proficiencia !== null) ?? null;
  const divergeDaProficiencia = Boolean(
    entradaDasAreas &&
      entradaDaProficiencia &&
      entradaDasAreas.simuladoId !== entradaDaProficiencia.simuladoId,
  );
  const areasSemResultado = Boolean(entradaDasAreas && entradaDasAreas.proficiencia === null);

  /**
   * % de acerto por grande área que a RPC do simulado JÁ devolve
   * (`acertoPorArea`). Prevalece sobre o valor recalculado no nível 1 — mas só
   * na visão individual: aquele número é de UM simulado e não vale como número
   * do recorte consolidado.
   */
  const acertoOficialPorArea =
    !modoTodos &&
    entradaDasAreas &&
    entradaAreaDetalhada &&
    entradaDasAreas.simuladoId === entradaAreaDetalhada.simuladoId
      ? new Map(areasDoAluno.map((a) => [a.area, a.acertoPct]))
      : undefined;




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

  const linkWhatsApp = linkWhatsAppAluno(contato.data?.telefone, resumoTexto);

  /**
   * Export do recorte DESTE aluno: uma linha por simulado, o mesmo agregado
   * cronológico que a tela mostra (nunca resposta a resposta, nunca outro
   * aluno). Quem monta é este drawer, que é onde o dado está; `AcoesRecorte`
   * segue sem receber lista (§7.7) e o gate de `podeExportar` continua sendo
   * dele.
   *
   * `onExportar` continua tendo prioridade quando quem compõe a tela quer
   * tratar o clique (telemetria própria, escopo diferente) — o arquivo local é
   * o padrão, não uma imposição.
   */
  const exportar = () => {
    if (onExportar) {
      onExportar(`aluno:${alunoId}`);
      return;
    }
    const gerou = baixarCsv(nomeArquivoCsv(['aluno', nomeExibido]), COLUNAS_ALUNO, cronologicas);
    toast(
      gerou
        ? { description: 'Arquivo CSV gerado com o recorte deste aluno.' }
        : { description: 'Não foi possível gerar o arquivo neste navegador.' },
    );
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
            CONTATO do aluno — telefone + "Enviar no WhatsApp" na MESMA seção
            (pedido de 09/08). O botão vivia no rodapé de ações, a uma tela de
            distância do número que ele usa: quem quer falar com o aluno lia o
            telefone aqui em cima, rolava o drawer inteiro e só então achava o
            atalho. Agora é um bloco só, no topo: o dado e a ação que ele
            habilita, lado a lado.

            Telefone (decisão de Felipe, 31/07/reafirmada 05/08): dado de
            CONTATO, não métrica — por isso fica aqui, nunca na grade
            Proficiência/Acertos/Posição/Variação abaixo. Busca própria
            (`useAlunoContato`), independente de `consulta`: carrega quando o
            drawer abre, para este aluno, nunca em lote. Ausência
            (`telefone: null`) e erro caem no mesmo TRACO — nunca zero, nunca
            string vazia, nunca um espaço em branco.

            Sem telefone cadastrado o botão não aparece (`linkWhatsApp` nulo):
            um "falar" que não tem com quem falar é um clique que só pode
            frustrar. Fica FORA do `AcoesRecorte` de propósito — aquele
            componente é o par Exportar/Copiar sob a capability de export, e
            falar com um aluno não é exportar dado.
          */}
          <div
            data-testid="drawer-contato"
            className="mt-3 flex items-center gap-3 px-3 py-2.5 text-left"
            style={{
              background: 'var(--gp-surface-2)',
              border: '1px solid var(--gp-border-subtle)',
              borderRadius: 'var(--gp-radius-sm)',
            }}
          >
            <div className="min-w-0 flex-1">
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--gp-text-3)',
                }}
              >
                Telefone
              </div>

              <div
                data-testid="drawer-telefone"
                style={{
                  fontFamily: FONTE_MONO,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--gp-text-1)',
                }}
              >
                {contato.isLoading ? 'Carregando telefone' : (contato.data?.telefone ?? TRACO)}
              </div>
            </div>
            {linkWhatsApp ? (
              <Button
                variant="outline"
                size="sm"
                data-testid="drawer-whatsapp"
                className="h-auto flex-none gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold"
                onClick={() => window.open(linkWhatsApp, '_blank', 'noopener,noreferrer')}
              >
                <Icon name="whatsapp" size={14} />
                Enviar no WhatsApp
              </Button>
            ) : null}
          </div>

        </SheetHeader>

        {consulta.isLoading ? (
          mostrarSkeleton ? (
            <CorpoAlunoSkeleton />
          ) : null
        ) : consulta.isError ? (
          <EstadoErro titulo="Não foi possível carregar este aluno." onRetry={() => consulta.refetch()} />
        ) : entradas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum simulado neste recorte"
            descricao="Ajuste o recorte de simulados para ver os dados deste aluno."
          />
        ) : (
          /*
            Visão GERAL do aluno, na ordem da referência: as notas de cada
            simulado, a evolução, o comparativo entre grandes áreas e um
            insight que nomeia uma delas. Antes, o drawer repetia um cartão
            completo por simulado — a mesma informação, quatro vezes, sem
            nunca responder "como este aluno está indo" numa tela só.
          */
          <div className="flex-1 space-y-5">
            <div className="space-y-1">
              <TituloSecao>Notas dos simulados</TituloSecao>
              {/* Cabeçalho da lista: sem ele, a coluna da direita é um número
                  solto — e é o número mais importante do painel. */}
              <div
                className="flex items-center justify-between gap-3 pb-1"
                style={{ fontSize: 10, color: 'var(--gp-text-3)' }}
              >
                <span>Simulado</span>
                <span>Proficiência</span>
              </div>
              <ul className="divide-y" style={{ borderColor: 'var(--gp-border-subtle)' }}>
                {cronologicas.map((entrada) => (
                  <LinhaSimulado key={entrada.simuladoId} entrada={entrada} />
                ))}
              </ul>
            </div>

            {/* Comparativo entre simulados: só existe com 2+ pontos medidos. */}
            {pontos.length > 1 ? (
              <div data-testid="drawer-evolucao" className="space-y-2">
                <TituloSecao>Evolução de proficiência</TituloSecao>
                <div
                  style={{
                    border: '1px solid var(--gp-border-strong)',
                    borderRadius: 12,
                    padding: '10px 8px 2px',
                    background: 'var(--gp-surface-2)',
                  }}
                >
                  <EvolucaoAluno pontos={pontos} />
                </div>
              </div>
            ) : null}

            {/*
              UM único bloco de desempenho por área (decisão de produto,
              09/08): o comparativo de barras por grande área e a cascata de
              especialidade/tema eram dois blocos sobre o mesmo assunto, e o
              segundo perdia o % ao abrir a granularidade. Agora a barra e o %
              acompanham os três níveis, e o detalhe aparece pela interação.

              Consulta PRÓPRIA (`useAlunoDesempenhoPorArea`), independente de
              `consulta`: uma falha aqui nunca esconde as notas/evolução acima.
            */}
            <div data-testid="drawer-areas" className="space-y-2">
              <TituloSecao>Desempenho por área · % de acerto</TituloSecao>

              {/* Chips de simulado: o bloco fala de UM simulado por vez, e quem
                  lê escolhe qual. Só aparece com 2+ opções — um chip solitário
                  seria controle sem escolha. */}
              {candidatasAreas.length > 1 ? (
                <div
                  role="group"
                  aria-label="Simulado do desempenho por área"
                  className="flex flex-wrap gap-1.5"
                >
                  {candidatasAreas.map((e, indice) => {
                    const ativo = e.simuladoId === entradaDasAreas?.simuladoId;
                    return (
                      <button
                        key={e.simuladoId}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setAreaEscolhida({ aluno: alunoId, simulado: e.simuladoId })}
                        className="rounded-full px-2.5 py-1 text-[11px] transition-colors"
                        style={{
                          border: `1px solid ${ativo ? 'var(--gp-brand)' : 'var(--gp-border-strong)'}`,
                          background: ativo ? 'var(--gp-brand-surface)' : 'transparent',
                          color: ativo ? 'var(--gp-brand)' : 'var(--gp-text-3)',
                          fontWeight: ativo ? 600 : 400,
                        }}
                      >
                        {`${indice + 1}º sim.`}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* De QUAL simulado sai o bloco. Sem esta linha, barras sem
                  procedência viram média imaginária na cabeça de quem lê. */}
              {entradaDasAreas || entradaAreaDetalhada ? (
                <div className="space-y-1">
                  <p style={{ fontSize: 11, color: 'var(--gp-text-2)', fontWeight: 600 }}>
                    {entradaDasAreas
                      ? `${entradaDasAreas.simuladoNome} · ${formatData(entradaDasAreas.simuladoData)}`
                      : entradaAreaDetalhada?.nome}
                    {areasSemResultado ? (
                      <span style={{ fontWeight: 400, color: 'var(--gp-text-3)' }}>
                        {' · resultado em processamento'}
                      </span>
                    ) : null}
                  </p>
                  {divergeDaProficiencia && entradaDaProficiencia ? (
                    <p data-testid="aviso-simulado-areas" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                      {`As barras abaixo são do ${entradaDasAreas?.simuladoNome}. A proficiência ${formatNumero(entradaDaProficiencia.proficiencia)} mostrada acima é do ${entradaDaProficiencia.simuladoNome}.`}
                    </p>
                  ) : null}
                  <p style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>toque para expandir</p>
                </div>
              ) : null}


              <div data-testid="drawer-desempenho-area" className="space-y-2">
                {desempenhoArea.isLoading ? (
                  <GestorSkeleton altura={64} rotulo="Carregando desempenho por área" />
                ) : desempenhoArea.isError ? (
                  <EstadoErro
                    titulo="Não foi possível carregar o desempenho por área."
                    onRetry={desempenhoArea.refetch}
                    className="py-3"
                  />
                ) : entradaAreaDetalhada ? (
                  <CascataDesempenhoAluno
                    areas={entradaAreaDetalhada.areas}
                    acertoOficialPorArea={acertoOficialPorArea}
                  />
                ) : (
                  <EstadoVazio compacto titulo="Sem classificação por tema neste recorte" />
                )}
              </div>

              {areasDoAluno.length > 0 && entradaDasAreas ? (
                <div className="pt-1">
                  <InsightArea areas={areasDoAluno} simuladoId={entradaDasAreas.simuladoId} />
                </div>
              ) : null}
            </div>


            {/*
              Insight do aluno por IA (task 09/08) — sempre por último: é a
              seção de custo mais alto (chamada de IA) e a única que depende
              de um clique explícito para existir.
            */}
            {MOSTRAR_INSIGHT_IA ? (
              <InsightAlunoIA iesId={iesId} alunoId={alunoId} simulados={simulados} />
            ) : null}
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
          {/*
            "Enviar no WhatsApp" NÃO fica mais aqui: subiu para a seção de
            CONTATO no topo do drawer (pedido de 09/08), junto ao telefone que
            ele usa. Este rodapé volta a ser só o par Exportar/Copiar sob a
            capability de export.
          */}

        </div>
      </SheetContent>
    </Sheet>
  );
}
