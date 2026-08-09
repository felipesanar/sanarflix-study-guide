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
  const descricao = pontos.map((p) => `${p.rotulo}: ${formatNumero(p.valor)}`).join('; ');

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
            {/* Data sob o ponto, no lugar de um eixo X: o nome do simulado
                não cabe em 5 colunas, e a data é o que ordena a leitura. */}
            <text
              x={x(i)}
              y={ALTURA - 12}
              fontSize={9}
              fill="var(--gp-text-3)"
              textAnchor="middle"
              fontFamily={FONTE_MONO}
            >
              {formatDataCurta(ponto.data)}
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
}

/** Uma grande área agrupada, com as especialidades e a contagem honesta de temas/críticos. */
interface GrandeAreaAgrupada {
  grandeArea: string;
  especialidades: EspecialidadeAgrupada[];
  totalTemas: number;
  totalCriticos: number;
}

/**
 * Agrupa as linhas de tema (a granularidade que `get_gestor_aluno_desempenho_por_area`
 * devolve) em grande área → especialidade → tema para o drill-down.
 *
 * Nenhum `acertoPct` é calculado para os níveis de grande área/especialidade
 * aqui — a RPC não devolve essa média, e inventá-la (seja por média simples
 * dos temas, seja por qualquer outra conta) seria a mesma classe de erro que
 * a "regra de agregação honesta" do drawer já proíbe para simulados
 * (`InsightArea`/comparativo abaixo). Os dois níveis de cima são só
 * AGRUPAMENTO visual — contagem de tema e de tema crítico, que são contagens
 * diretas sobre o dado recebido, nunca um número sintetizado.
 *
 * Temas dentro de uma especialidade saem ordenados do PIOR para o melhor
 * acerto — "comece pela pior" é o mesmo critério já usado em
 * `DiagnosticoCriticoVazio` (`CascataDiagnostico.tsx`). Grande área e
 * especialidade saem em ordem alfabética: sem um número de nível para
 * ordenar por severidade, alfabética é a única ordem estável.
 */
function agruparPorArea(areas: AreaDesempenhoAluno[]): GrandeAreaAgrupada[] {
  const porGrandeArea = new Map<string, Map<string, AreaDesempenhoAluno[]>>();

  for (const area of areas) {
    if (!porGrandeArea.has(area.grandeArea)) porGrandeArea.set(area.grandeArea, new Map());
    const porEspecialidade = porGrandeArea.get(area.grandeArea)!;
    if (!porEspecialidade.has(area.especialidade)) porEspecialidade.set(area.especialidade, []);
    porEspecialidade.get(area.especialidade)!.push(area);
  }

  return [...porGrandeArea.entries()]
    .map(([grandeArea, especialidadesMapa]) => {
      const especialidades: EspecialidadeAgrupada[] = [...especialidadesMapa.entries()]
        .map(([especialidade, temas]) => ({
          especialidade,
          temas: [...temas].sort((a, b) => a.acertoPct - b.acertoPct),
        }))
        .sort((a, b) => a.especialidade.localeCompare(b.especialidade, 'pt-BR'));

      const totalTemas = especialidades.reduce((soma, e) => soma + e.temas.length, 0);
      const totalCriticos = especialidades.reduce(
        (soma, e) => soma + e.temas.filter((t) => t.critica).length,
        0,
      );

      return { grandeArea, especialidades, totalTemas, totalCriticos };
    })
    .sort((a, b) => a.grandeArea.localeCompare(b.grandeArea, 'pt-BR'));
}

/** Nível 3 (folha) do drill-down: o tema, com as métricas cruas da RPC. */
function LinhaTema({ tema }: { tema: AreaDesempenhoAluno }) {
  const cor = tema.critica ? 'var(--gp-danger-on)' : 'var(--gp-text-2)';
  return (
    <li
      data-testid={`drawer-tema-${tema.tema}`}
      className="flex items-center justify-between gap-2 py-1.5 pl-1"
      style={{ fontSize: 12 }}
    >
      <span className="min-w-0 truncate" style={{ color: cor, fontWeight: tema.critica ? 600 : undefined }}>
        {tema.tema}
        {/* Cor nunca é canal único: a criticidade também sai por texto, mesma regra da BarraArea. */}
        {tema.critica ? <span className="sr-only"> (tema crítico)</span> : null}
      </span>
      <span className="flex flex-none items-center gap-2.5" style={{ color: 'var(--gp-text-3)' }}>
        <span style={{ fontFamily: FONTE_MONO }}>
          {`${formatNumero(tema.questoesRespondidas)}/${formatNumero(tema.questoesTotal)}`}
        </span>
        <span style={{ fontFamily: FONTE_MONO, color: cor, fontWeight: 600, width: 34, textAlign: 'right' }}>
          {formatPct(tema.acertoPct)}
        </span>
      </span>
    </li>
  );
}

/** Nível 2 do drill-down: a especialidade, expandindo para a lista de temas. */
function LinhaEspecialidade({
  grupo,
  aberto,
  onClick,
}: {
  grupo: EspecialidadeAgrupada;
  aberto: boolean;
  onClick: () => void;
}) {
  const criticos = grupo.temas.filter((t) => t.critica).length;
  return (
    <li>
      <button
        type="button"
        data-especialidade-cascata=""
        onClick={onClick}
        aria-expanded={aberto}
        data-testid={`drawer-especialidade-${grupo.especialidade}`}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ fontSize: 12, fontWeight: 600 }}
      >
        <Icon
          name={aberto ? 'expand_more' : 'chevron_right'}
          variant="outlined"
          size={14}
          box={14}
          className={aberto ? 'text-foreground' : 'text-muted-foreground'}
        />
        <span className="min-w-0 flex-1 truncate">{grupo.especialidade}</span>
        <span style={{ fontWeight: 400, color: 'var(--gp-text-3)' }}>
          {`${grupo.temas.length} ${grupo.temas.length === 1 ? 'tema' : 'temas'}`}
        </span>
        {criticos > 0 ? (
          <span style={{ color: 'var(--gp-danger-on)' }}>{`${criticos} ${criticos === 1 ? 'crítico' : 'críticos'}`}</span>
        ) : null}
      </button>
      {aberto ? (
        <ul
          data-testid={`drawer-temas-de-${grupo.especialidade}`}
          className="ml-4 border-l pl-2"
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
 * Drill-down grande área → especialidade → tema de UM simulado do aluno
 * (spec da task, 09/08) — reaproveita o padrão visual de cascata de
 * `CascataDiagnostico.tsx`/`DrawerTemas.tsx` (disclosure por chevron, um
 * ramo aberto por nível) na escala do drawer: dois níveis de acordeão
 * (grande área e, dentro dela, especialidade) que revelam a folha (tema).
 *
 * Acordeão de UM aberto por nível — clicar outra grande área fecha a
 * especialidade que estivesse aberta dentro da anterior, mesma exclusividade
 * de `nodeAberto` na cascata do Diagnóstico.
 */
function CascataDesempenhoAluno({ areas }: { areas: AreaDesempenhoAluno[] }) {
  const grupos = React.useMemo(() => agruparPorArea(areas), [areas]);
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
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--gp-text-1)' }}
            >
              <Icon
                name={aberto ? 'expand_more' : 'chevron_right'}
                variant="outlined"
                size={16}
                box={16}
                className={aberto ? 'text-foreground' : 'text-muted-foreground'}
              />
              <span className="min-w-0 flex-1 truncate">{grupo.grandeArea}</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gp-text-3)' }}>
                {`${grupo.totalTemas} ${grupo.totalTemas === 1 ? 'tema' : 'temas'}`}
              </span>
              {grupo.totalCriticos > 0 ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gp-danger-on)' }}>
                  {`${grupo.totalCriticos} ${grupo.totalCriticos === 1 ? 'crítico' : 'críticos'}`}
                </span>
              ) : null}
            </button>
            {aberto ? (
              <ul
                data-testid={`drawer-especialidades-de-${grupo.grandeArea}`}
                className="ml-4 border-l pl-2"
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
  const pontos: PontoEvolucao[] = cronologicas
    .filter((e): e is AlunoSimuladoEntry & { proficiencia: number } => e.proficiencia !== null)
    .map((e) => ({ rotulo: e.simuladoNome, valor: e.proficiencia, data: e.simuladoData }));

  /**
   * O comparativo entre grandes áreas é UM, e é o do simulado MAIS RECENTE
   * que tenha classificação por área.
   *
   * A referência mostra um único conjunto de barras por aluno; o payload
   * traz `acertoPorArea` por SIMULADO. Fundir os simulados numa média por
   * área seria produzir número que a RPC não devolve — exatamente o que a
   * regra de agregação honesta proíbe (mesma família de "Conceito ENAMED não
   * tem média"). Então o comparativo é recortado, não fundido: o simulado
   * mais recente, dito com todas as letras no subtítulo da seção.
   *
   * `.reverse()` sobre uma CÓPIA — `cronologicas` já é cópia de `entradas`,
   * mas reverter no lugar mudaria a ordem da lista de notas e da série, que
   * são renderizadas a partir dela.
   */
  const entradaDasAreas =
    [...cronologicas].reverse().find((e) => (e.acertoPorArea ?? []).length > 0) ?? null;
  const areasDoAluno = [...(entradaDasAreas?.acertoPorArea ?? [])].sort(
    (a, b) => b.acertoPct - a.acertoPct,
  );

  /**
   * Mesma regra de recorte do comparativo acima, aplicada ao drill-down por
   * tema: UM simulado, o mais recente que tenha classificação, NUNCA fundido
   * entre simulados. `get_gestor_aluno_desempenho_por_area` é uma consulta
   * própria (`desempenhoArea`, hook `useAlunoDesempenhoPorArea`) — casada por
   * `simuladoId` contra a mesma ordem cronológica de `cronologicas`, para que
   * "mais recente" signifique a mesma coisa nas duas seções.
   */
  const areaPorSimulado = new Map(
    (desempenhoArea.data ?? []).map((entrada) => [entrada.simuladoId, entrada]),
  );
  const entradaAreaDetalhada: DesempenhoPorAreaSimulado | null =
    [...cronologicas]
      .reverse()
      .map((e) => areaPorSimulado.get(e.simuladoId))
      .find((d): d is DesempenhoPorAreaSimulado => d !== undefined && d.areas.length > 0) ?? null;

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

            {areasDoAluno.length > 0 && entradaDasAreas ? (
              <div data-testid="drawer-areas" className="space-y-2">
                <TituloSecao>Comparativo entre grandes áreas · % de acerto</TituloSecao>
                {/* De QUAL simulado saem estas barras. Sem esta linha, quatro
                    barras sem procedência viram média imaginária na cabeça de
                    quem lê. */}
                <p style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                  {`${entradaDasAreas.simuladoNome} · ${formatData(entradaDasAreas.simuladoData)}`}
                </p>
                <div className="flex flex-col gap-2 pt-0.5">
                  {areasDoAluno.map((area) => (
                    <BarraArea
                      key={area.area}
                      area={area.area}
                      acertoPct={area.acertoPct}
                      critica={area.critica}
                    />
                  ))}
                </div>
                <div className="pt-1">
                  <InsightArea areas={areasDoAluno} simuladoId={entradaDasAreas.simuladoId} />
                </div>
              </div>
            ) : null}

            {/*
              Drill-down grande área → especialidade → tema (task 09/08).
              Consulta PRÓPRIA (`useAlunoDesempenhoPorArea`), independente de
              `consulta`: uma falha aqui nunca esconde as notas/evolução/
              comparativo acima, que já carregaram com sucesso.
            */}
            <div data-testid="drawer-desempenho-area" className="space-y-2">
              <TituloSecao>Desempenho por área, especialidade e tema</TituloSecao>
              {desempenhoArea.isLoading ? (
                <GestorSkeleton altura={64} rotulo="Carregando desempenho por área" />
              ) : desempenhoArea.isError ? (
                <EstadoErro
                  titulo="Não foi possível carregar o desempenho por área."
                  onRetry={desempenhoArea.refetch}
                  className="py-3"
                />
              ) : entradaAreaDetalhada ? (
                <>
                  {/* De QUAL simulado sai a cascata — mesma âncora de proveniência do comparativo acima. */}
                  <p style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                    {`${entradaAreaDetalhada.nome} · toque para expandir`}
                  </p>
                  <CascataDesempenhoAluno areas={entradaAreaDetalhada.areas} />
                </>
              ) : (
                <EstadoVazio compacto titulo="Sem classificação por tema neste recorte" />
              )}
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
            "Falar no WhatsApp" (reunião de 07/08: "lembra de botar aqui a
            mesma coisa de copiar e o botão que você botou lá antes? o de
            levar para o WhatsApp").

            Leva o MESMO resumo agregado do "Copiar resumo" — nunca lista
            nominal de terceiros (§7.7) —, e vai para o telefone do PRÓPRIO
            aluno, que já está no cabeçalho deste drawer (`useAlunoContato`).
            Sem telefone cadastrado o botão não aparece: um "falar" que não
            tem com quem falar é um clique que só pode frustrar. Fora do
            `AcoesRecorte` de propósito — aquele componente é o par
            Exportar/Copiar sob a capability de export, e falar com um aluno
            não é exportar dado.
          */}
          {linkWhatsApp ? (
            <Button
              variant="outline"
              size="sm"
              data-testid="drawer-whatsapp"
              className="h-auto gap-1.5 rounded-sm px-3.5 py-2 text-xs font-semibold"
              onClick={() => window.open(linkWhatsApp, '_blank', 'noopener,noreferrer')}
            >
              <Icon name="whatsapp" size={14} />
              Enviar no WhatsApp
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
