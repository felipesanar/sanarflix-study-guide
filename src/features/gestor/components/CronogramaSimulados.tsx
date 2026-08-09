import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCronograma } from '@/features/gestor/api/queries';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';
import { formatData } from '@/features/gestor/lib/formatters';
import { BadgeStatus } from '@/features/gestor/components/BadgeStatus';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import { formatDataHora } from '@/features/gestor/components/TooltipRastreabilidade';
import type { ItemCronograma, Meta } from '@/features/gestor/api/types';

/** Mesmo número já usado nos fluxos de suporte do app (QuickActionsDock, SanarClass). */
export const WHATSAPP_SANAR = '5571993120049';

/**
 * Altura do bloco no Início. O mesmo número é usado pelo skeleton, pelo vazio e
 * pelo erro — e é o mesmo do fallback de `Inicio.tsx`, para que a sequência
 * "contexto carregando → bloco carregando → erro" não mude a altura três vezes
 * (spec §8.4: "cada card mantém a altura final, sem salto de layout").
 */
export const ALTURA_BLOCO = 288;

/**
 * Textos placeholder distintos por ação (decisão 24/07): as duas ações são
 * redirects simples para o WhatsApp, sem fluxo de agendamento no produto.
 *
 * `simuladoNome` entra na mensagem quando a ação parte da linha de um simulado
 * específico — com dois ou mais contratados sem data, um "quero definir a data
 * de um simulado" genérico obriga o consultor a perguntar qual.
 */
export const MSG_AGENDAR = (iesNome: string, simuladoNome?: string): string =>
  simuladoNome
    ? `Olá! Sou gestor(a) da ${iesNome} no SanarFlix Academy e quero definir a data do simulado "${simuladoNome}", já contratado.`
    : `Olá! Sou gestor(a) da ${iesNome} no SanarFlix Academy e quero definir a data de um simulado já contratado.`;

export const MSG_CONSULTOR = (iesNome: string): string =>
  `Olá! Sou gestor(a) da ${iesNome} no SanarFlix Academy e gostaria de falar com um consultor sobre o contrato de simulados.`;

/**
 * Datas por modalidade (§6.4): online tem data de início; presencial, data de
 * realização. A liberação do resultado do online não existe em `ItemCronograma`
 * e depende da superfície de admin (§6.3) — fora desta fase.
 */
const ROTULO_DATA: Record<'online' | 'presencial', string> = {
  online: 'Início',
  presencial: 'Realização',
};

/**
 * Pílula de modalidade da referência (§10.12, anatomia §5 `modalidade`).
 *
 * A referência distingue "Online síncrono" de "Online assíncrono", mas
 * `ItemCronograma.modalidade` só carrega `online | presencial` — afirmar
 * síncrono/assíncrono aqui seria inventar dado que a RPC não devolve (§4.10).
 * Fica "Online" até o contrato da API ganhar a granularidade.
 */
const ROTULO_MODALIDADE: Record<'online' | 'presencial', string> = {
  online: 'Online',
  presencial: 'Presencial',
};

/**
 * Selo do próximo simulado — a ÚNICA pílula de marca sólida da referência
 * inteira. A anatomia `selo` de `Tag` é a de fundo tintado ("atual"); esta
 * densidade sólida ainda não existe em `Tag`, então vem por `style` sobre a
 * mesma primitiva, sem raio nem cor solta.
 */
const SELO_PROXIMO: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.06em',
  color: 'var(--gp-on-brand)',
  background: 'var(--gp-brand)',
  padding: '2px 9px',
};

/**
 * Shimmer do skeleton (mesmos tons de `GestorSkeleton`/`gestor-theme.css`,
 * spec §6): gradiente que varre a superfície, calibrado nos dois temas via
 * `--gp-skeleton`/`--gp-skeleton-brilho`. Duplicado aqui (em vez de reusar
 * `GestorSkeleton`) porque cada linha do cronograma precisa de DUAS formas
 * distintas lado a lado — nome + pílula de status —, e `GestorSkeleton`
 * desenha uma mancha só por instância, cada uma com seu próprio
 * `role="status"`; a linha inteira já carrega esse papel.
 */
const SKELETON_SHIMMER: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--gp-skeleton) 25%, var(--gp-skeleton-brilho) 50%, var(--gp-skeleton) 75%)',
  backgroundSize: '200% 100%',
};

/**
 * Linha de skeleton do cronograma (spec §5 item 8): a linha real nunca é uma
 * mancha só — tem o nome do simulado à esquerda e uma pílula de status
 * separada à direita (agendado/em andamento/encerrado). O skeleton reproduz
 * as DUAS formas, não uma barra única do tamanho da linha.
 */
function LinhaSkeleton() {
  return (
    <div
      data-testid="cronograma-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Carregando cronograma"
      className="flex items-center justify-between gap-3 px-3 py-3"
    >
      {/* Barra do nome do simulado — ~60% da largura, como o texto real. */}
      <span
        aria-hidden="true"
        className="h-3.5 w-3/5 flex-none animate-shimmer"
        style={{ ...SKELETON_SHIMMER, borderRadius: 'var(--gp-radius-pill)' }}
      />
      {/* Pílula de status, separada da barra de nome. */}
      <span
        aria-hidden="true"
        className="h-5 w-16 flex-none animate-shimmer"
        style={{ ...SKELETON_SHIMMER, borderRadius: 'var(--gp-radius-pill)' }}
      />
    </div>
  );
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const DIAS_DA_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/**
 * Dia e mês abreviado do bloco de data do cartão do próximo simulado.
 *
 * Lê os dígitos do ISO, sem instanciar `Date` a partir da string — pelo mesmo
 * motivo documentado em `formatData`: `new Date('2026-08-16')` é meia-noite
 * UTC e, em UTC-3, viraria 15/08.
 */
export function blocoData(iso: string | null): { dia: string; mes: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return null;
  const [, , mes, dia] = match;
  return { dia, mes: MESES[Number(mes) - 1] };
}

/** Dia da semana por extenso, montado a partir dos dígitos (meia-noite LOCAL). */
export function diaDaSemana(iso: string | null): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return null;
  const [, ano, mes, dia] = match;
  return DIAS_DA_SEMANA[new Date(Number(ano), Number(mes) - 1, Number(dia)).getDay()];
}

/**
 * Próximo simulado = agendado/reagendado com a data mais próxima, **ainda no
 * futuro** em relação a `agora` (achados 11 e 18, revisão de 03/08).
 *
 * A derivação de status no servidor não compara com `now()` (§6.4 deriva só a
 * partir de encerramento/participação/reagendamento) — então um simulado
 * liberado há dias, com data já passada mas que a Sanar ainda não marcou como
 * encerrado, continua chegando como `agendado`. Chamá-lo de "próximo" seria
 * destacar algo que já passou. Sem nenhum item no futuro, não há próximo —
 * estado legítimo (nenhum destaque), não um erro.
 */
export function proximoSimulado(
  itens: ItemCronograma[],
  agora: Date = new Date(),
): string | null {
  const candidatos = itens
    .filter(
      (item) =>
        (item.status === 'agendado' || item.status === 'reagendado') &&
        item.data !== null &&
        new Date(item.data) >= agora,
    )
    .sort((a, b) => (a.data as string).localeCompare(b.data as string));

  return candidatos[0]?.id ?? null;
}

/**
 * Contador de resumo do cabeçalho (§10.12). Só entram as parcelas que existem:
 * "0 agendados" seria ruído, e um resumo de lista vazia não é resumo nenhum —
 * daí o `null`, que o chamador usa para não renderizar a pílula.
 */
export function resumoCronograma(itens: ItemCronograma[]): string | null {
  const contar = (...status: ItemCronograma['status'][]) =>
    itens.filter((item) => status.includes(item.status)).length;

  const parcelas: string[] = [];
  const realizados = contar('realizado');
  const agendados = contar('agendado', 'reagendado');
  const processando = contar('processing');
  const semData = contar('previsto');

  if (realizados > 0) parcelas.push(`${realizados} ${realizados === 1 ? 'realizado' : 'realizados'}`);
  if (agendados > 0) parcelas.push(`${agendados} ${agendados === 1 ? 'agendado' : 'agendados'}`);
  if (processando > 0) parcelas.push(`${processando} em processamento`);
  if (semData > 0) parcelas.push(`${semData} sem data`);

  return parcelas.length > 0 ? parcelas.join(' · ') : null;
}

/**
 * Texto do rodapé de proveniência, a partir de `meta.periodo` de
 * `useCronograma(iesId)` — nunca do `contrato` do contexto do usuário, que é
 * da IES padrão dele e não acompanha a troca de IES no dropdown (achados 1,
 * 3, 4 e 7 da revisão de 03/08; mesma armadilha documentada em
 * `SidebarIes.tsx:71-75`). `meta.periodo` já vem escopado à IES que a query
 * de fato consultou (`p_ies_id`), incluindo o texto de fallback do servidor
 * quando a IES não tem contrato cadastrado — usado como veio, sem inventar
 * campo (spec §4.10).
 */
export function rotuloVigenciaContrato(periodo: string): string {
  if (periodo.toLowerCase().startsWith('sem contrato')) return periodo;
  return `Vigência do contrato ${periodo}`;
}

/**
 * Rodapé de proveniência completo (§10.12). A referência lista contrato, nº de
 * simulados, origem e frescor; `get_gestor_cronograma` só devolve vigência e
 * `atualizadoEm` no `meta` — nome do contrato e nº contratado ficam de fora até
 * a RPC devolvê-los escopados ao `p_ies_id` (afirmar o contrato do
 * `ContextoGestor` aqui repetiria o achado 1 da revisão de 03/08).
 */
export function textoProveniencia(meta: Meta): string {
  const partes = [rotuloVigenciaContrato(meta.periodo), 'publicado pela Sanar'];
  if (meta.atualizadoEm) partes.push(`atualizado em ${formatDataHora(meta.atualizadoEm)}`);
  return partes.join(' · ');
}

function abrirWhatsApp(texto: string): void {
  window.open(
    `https://wa.me/${WHATSAPP_SANAR}?text=${encodeURIComponent(texto)}`,
    '_blank',
    'noopener,noreferrer',
  );
}

export interface CronogramaSimuladosProps {
  iesId: string;
  iesNome: string;
}

/** O "i" do cabeçalho (§10.12) — significado só no ícone, então carrega rótulo. */
const AJUDA_CRONOGRAMA =
  'O cronograma é publicado pela Sanar a partir do contrato da instituição. Datas e status vêm de lá.';

function Moldura({
  children,
  contador,
}: {
  children: React.ReactNode;
  contador?: React.ReactNode;
}) {
  return (
    <Card data-testid="cronograma">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex flex-none items-center" style={{ color: 'var(--gp-text-2)' }}>
            <Icon name="calendar_month" variant="filled" size={18} />
          </span>
          {/* aria-level={2}: o CardTitle do shadcn renderiza <h3> e este card é
              título de primeiro nível da rota, logo abaixo do h1 da saudação —
              sem isso o axe acusa heading-order (§11). Corrigido por ARIA em vez
              de mexer em components/ui/card.tsx, que é compartilhado com as
              experiências de aluno e admin. */}
          <CardTitle className="text-base" aria-level={2}>Cronograma de Simulados</CardTitle>
          <span
            className="flex flex-none cursor-help items-center"
            style={{ color: 'var(--gp-border-input)' }}
            title={AJUDA_CRONOGRAMA}
          >
            <Icon name="info" size={15} label={AJUDA_CRONOGRAMA} />
          </span>
          {contador}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Coluna de data da linha do cronograma (referência §10.12): "10 mai" à
 * ESQUERDA do nome, na mesma métrica do bloco de data do cartão do próximo —
 * é o que dá à lista uma régua temporal legível de cima a baixo, em vez de
 * enterrar a data numa linha de metadados sob o nome.
 *
 * O rótulo por modalidade ("Início" no online, "Realização" no presencial) e a
 * data por extenso continuam ditos — em `sr-only` e no `title`. São informação
 * de desambiguação, não de varredura: quem lê a lista quer a régua; quem
 * precisa do rótulo exato o alcança pelo leitor de tela ou pelo hover.
 */
function ColunaData({ item }: { item: ItemCronograma }) {
  const bloco = blocoData(item.data);
  const porExtenso = `${item.modalidade ? `${ROTULO_DATA[item.modalidade]}: ` : ''}${formatData(item.data)}`;

  return (
    <span
      className="flex flex-none items-baseline gap-1"
      style={{ width: 46 }}
      title={porExtenso}
    >
      <span className="sr-only">{porExtenso}</span>
      {bloco ? (
        <>
          <span
            aria-hidden="true"
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--gp-text-1)' }}
          >
            {bloco.dia}
          </span>
          <span aria-hidden="true" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
            {bloco.mes}
          </span>
        </>
      ) : (
        <span aria-hidden="true" style={{ fontSize: 13, color: 'var(--gp-text-3)' }}>
          —
        </span>
      )}
    </span>
  );
}

/** Pílula de modalidade — só quando o dado existe; ausência não vira chute. */
function PilulaModalidade({ item }: { item: ItemCronograma }) {
  if (!item.modalidade) return null;
  return <Tag variant="modalidade">{ROTULO_MODALIDADE[item.modalidade]}</Tag>;
}

/**
 * Linha padrão do cronograma. Só `realizado` tem `resultados_ies_tri` no banco
 * — os outros status abririam o Detalhamento vazio, então a linha continua na
 * lista mas desabilitada (§4.7.1).
 */
function ItemLinha({ item }: { item: ItemCronograma }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navegavel = item.status === 'realizado';

  const abrirNoDetalhamento = () => {
    // Preserva o recorte global (ies, semestre) já na URL — só a chave
    // `simulados` é sobrescrita pelo clique. Sem isso, o Detalhamento perde a
    // IES selecionada e a home reseeda com `contexto.iesAtual`, que nem
    // sempre é a IES em foco (ex.: admin impersonando um gestor).
    const params = new URLSearchParams(location.search);
    params.set('simulados', item.id);
    navigate({ pathname: '/gestor/detalhamento', search: params.toString() });
  };

  /**
   * `realizado` sem data (achado 20, revisão de 03/08): simulado presencial
   * legado com `data_realizacao`/`data_liberacao` nulas — mas que já tem
   * participação e resultado de TRI, então a RPC deriva `realizado` mesmo
   * assim. Isso NÃO é "contratado sem data" (`previsto`, ainda pendente de
   * agendamento pela Sanar): já aconteceu, só falta a data no banco. A RPC só
   * seta `indisponivelPorque` para `previsto`/`processing` — sem este aviso,
   * o item mostraria "Realização: —" ao lado de itens com data real, sem
   * explicação nenhuma.
   */
  const semDataRegistrada =
    !item.indisponivelPorque && item.status === 'realizado' && item.data === null;

  return (
    <button
      type="button"
      disabled={!navegavel}
      data-testid={`cronograma-item-${item.id}`}
      data-destaque="false"
      onClick={abrirNoDetalhamento}
      className={cn(
        // rounded-sm = --gp-radius-sm (8px). `rounded-md` do Tailwind resolve
        // para calc(--radius - 2px) = 10px, um raio intermediário que a escala
        // do handoff não tem.
        // 140ms = motion-2 do handoff; o default do Tailwind é 150ms, fora da
        // régua de durações.
        'flex w-full items-center justify-between gap-3 rounded-sm px-3 py-3 text-left transition-colors [transition-duration:140ms]',
        navegavel &&
          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !navegavel && 'cursor-default',
      )}
    >
      <ColunaData item={item} />

      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{item.nome}</span>
        {/* Segunda linha SÓ quando há o que dizer. A data saiu daqui para a
            coluna da esquerda; sobraram participação e as duas ressalvas.
            Antes, uma linha realizada sem participantes e sem ressalva ainda
            gastava uma linha inteira com "Início: —" — texto que não informa
            nada que a coluna de data já não mostre. */}
        {typeof item.participantes === 'number' && (
          <p className="text-xs text-muted-foreground">{`${item.participantes} participantes`}</p>
        )}
        {item.indisponivelPorque && (
          <p className="text-xs text-muted-foreground">{item.indisponivelPorque}</p>
        )}
        {semDataRegistrada && (
          <p className="text-xs text-muted-foreground">Data de realização não registrada</p>
        )}
      </div>

      <PilulaModalidade item={item} />
      <BadgeStatus status={item.status} />
      {navegavel && (
        // Afordância visual, não um segundo controle: a linha inteira já é o
        // botão que navega. Um <a> aqui dentro seria interativo aninhado.
        <span className="flex flex-none items-center gap-[3px] text-[11px] font-semibold text-primary">
          Resultados
          <Icon name="chevron_right" size={13} />
        </span>
      )}
    </button>
  );
}

/**
 * Cartão do próximo simulado (§10.12): sai da lista e vai para o topo do bloco.
 * Não é um controle — agendado/reagendado não têm resultado para abrir, e um
 * botão desabilitado do tamanho de um cartão promete um clique que não existe.
 */
function CartaoProximo({ item }: { item: ItemCronograma }) {
  const bloco = blocoData(item.data);
  const semana = diaDaSemana(item.data);

  return (
    <div
      data-testid={`cronograma-item-${item.id}`}
      data-destaque="true"
      className="mb-3 flex items-center gap-4 border-[1.5px] border-primary p-4"
      style={{ borderRadius: 'var(--gp-radius-md)', background: 'var(--gp-brand-surface)' }}
    >
      {bloco && (
        <div className="flex-none text-center" style={{ width: 52 }}>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: '24px', color: 'var(--gp-text-1)' }}>
            {bloco.dia}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--gp-text-3)',
            }}
          >
            {bloco.mes}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Tag variant="selo" style={SELO_PROXIMO}>
            Próximo
          </Tag>
          <span className="truncate text-sm font-semibold text-foreground">{item.nome}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {semana ? `${semana} · ` : ''}
          {item.modalidade ? `${ROTULO_DATA[item.modalidade]}: ` : ''}
          {formatData(item.data)}
        </p>
        {item.indisponivelPorque && (
          <p className="text-xs text-muted-foreground">{item.indisponivelPorque}</p>
        )}
      </div>

      <PilulaModalidade item={item} />
      <BadgeStatus status={item.status} />
    </div>
  );
}

/**
 * Contratado sem data (§10.12): moldura tracejada, tile de calendário e a ação
 * de agendar NA PRÓPRIA LINHA — com dois ou mais previstos, um "Agendar" no
 * rodapé do grupo não diz a qual simulado se refere.
 */
function LinhaSemData({ item, onAgendar }: { item: ItemCronograma; onAgendar: () => void }) {
  return (
    <div
      data-testid={`cronograma-item-${item.id}`}
      data-destaque="false"
      className="flex items-center gap-3 border border-dashed px-3 py-3"
      style={{ borderRadius: 'var(--gp-radius-sm)', borderColor: 'var(--gp-border-input)' }}
    >
      <span
        aria-hidden="true"
        className="flex flex-none items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--gp-radius-sm)',
          background: 'var(--gp-surface-3)',
          color: 'var(--gp-text-3)',
        }}
      >
        <Icon name="edit_calendar" size={18} />
      </span>

      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{item.nome}</span>
        <p className="text-xs text-muted-foreground">
          Sem data · defina para publicar no calendário dos alunos
        </p>
        {item.indisponivelPorque && (
          <p className="text-xs text-muted-foreground">{item.indisponivelPorque}</p>
        )}
      </div>

      <BadgeStatus status={item.status} />
      {/* Item B4 do passe de conformidade: receita de botão de AÇÃO EM
          PÁGINA (8px de raio, 8px 14px de padding, 12px/600 — bate com o
          handoff) em vez do `size="sm"` cru (herdando h-9/px-3/text-sm do
          primitivo compartilhado com aluno/admin). Corrigido na revisão
          final (F4): esta receita NÃO é a mesma de EstadoErro/EstadoVazio
          — aqueles usam `px-3 py-1.5 text-[11px]`, a receita de botão de
          RETRY EM ESTADO, um papel diferente. Duas receitas distintas para
          dois papéis distintos; não "alinhe" um lado no outro. */}
      <Button
        variant="outline"
        size="sm"
        className="h-auto flex-none rounded-sm px-3.5 py-2 text-xs font-semibold"
        onClick={onAgendar}
      >
        Agendar data
      </Button>
    </div>
  );
}

/**
 * Cronograma de simulados contratados — âncora da home (spec §2.2, §6.4).
 * O servidor já manda o `status` derivado; este componente só traduz.
 */
export function CronogramaSimulados({ iesId, iesNome }: CronogramaSimuladosProps) {
  const { data, meta, isLoading, isError, refetch } = useCronograma(iesId);
  // Regra dos 400ms (spec §7, `useDelayedLoading`): numa carga fria (sem
  // dado anterior em cache), `isLoading` fica `true` desde o primeiro
  // render — sem o atraso, toda montagem piscaria o skeleton mesmo quando a
  // rede responde em 150–300ms.
  const mostrarSkeleton = useDelayedLoading(isLoading);

  if (isLoading) {
    // Abaixo de 400ms a moldura já está de pé (título, borda, "i") mas o
    // corpo fica vazio — nunca cai para "Nenhum simulado contratado", que
    // seria um vazio inventado enquanto o dado real ainda está em voo.
    if (!mostrarSkeleton) return <Moldura>{null}</Moldura>;

    return (
      <Moldura>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((linha) => (
            <LinhaSkeleton key={linha} />
          ))}
        </div>
      </Moldura>
    );
  }

  if (isError) {
    return (
      <Moldura>
        <EstadoErro
          titulo="Não foi possível carregar o cronograma."
          altura={ALTURA_BLOCO}
          onRetry={refetch}
        />
      </Moldura>
    );
  }

  const itens = data ?? [];

  if (itens.length === 0) {
    return (
      <Moldura>
        <EstadoVazio
          titulo="Nenhum simulado contratado"
          descricao="Quando a Sanar registrar o contrato da instituição, o cronograma aparece aqui."
          glifo="calendar_month"
          glifoVariante="filled"
          altura={ALTURA_BLOCO}
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-auto rounded-sm px-3.5 py-2 text-xs font-semibold"
          onClick={() => abrirWhatsApp(MSG_CONSULTOR(iesNome))}
        >
          Falar com consultor
        </Button>
      </Moldura>
    );
  }

  const destaqueId = proximoSimulado(itens);
  const destaque = itens.find((item) => item.id === destaqueId) ?? null;
  const previstos = itens.filter((item) => item.status === 'previsto');
  // O destacado sai da lista: repetido, ele apareceria duas vezes no bloco.
  const comData = itens.filter(
    (item) => item.status !== 'previsto' && item.id !== destaqueId,
  );
  const resumo = resumoCronograma(itens);

  return (
    <Moldura
      contador={
        resumo ? (
          <span className="ml-auto flex-none" data-testid="cronograma-resumo">
            <Tag variant="contador">{resumo}</Tag>
          </span>
        ) : undefined
      }
    >
      {destaque && <CartaoProximo item={destaque} />}

      <ul className="divide-y divide-border">
        {comData.map((item) => (
          <li key={item.id} className="py-1">
            <ItemLinha item={item} />
          </li>
        ))}
      </ul>

      {previstos.length > 0 && (
        <div data-testid="cronograma-sem-data" className="mt-4 flex flex-col gap-2">
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--gp-text-3)',
            }}
          >
            {`Contratados sem data definida · ${previstos.length}`}
          </span>
          <ul className="flex flex-col gap-2">
            {previstos.map((item) => (
              <li key={item.id}>
                <LinhaSemData
                  item={item}
                  onAgendar={() => abrirWhatsApp(MSG_AGENDAR(iesNome, item.nome))}
                />
              </li>
            ))}
          </ul>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto rounded-sm px-3.5 py-2 text-xs font-semibold"
              onClick={() => abrirWhatsApp(MSG_CONSULTOR(iesNome))}
            >
              Falar com consultor
            </Button>
          </div>
        </div>
      )}

      {meta && (
        <p
          data-testid="cronograma-proveniencia"
          className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground"
        >
          <span className="flex flex-none items-center" style={{ color: 'var(--gp-border-input)' }}>
            <Icon name="info" size={14} />
          </span>
          {textoProveniencia(meta)}
        </p>
      )}
    </Moldura>
  );
}
