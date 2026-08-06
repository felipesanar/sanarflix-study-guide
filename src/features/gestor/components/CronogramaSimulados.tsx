import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarPlus, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCronograma } from '@/features/gestor/api/queries';
import { formatData } from '@/features/gestor/lib/formatters';
import { BadgeStatus } from '@/features/gestor/components/BadgeStatus';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import type { ItemCronograma } from '@/features/gestor/api/types';

/** Mesmo número já usado nos fluxos de suporte do app (QuickActionsDock, SanarClass). */
export const WHATSAPP_SANAR = '5571993120049';

/**
 * Textos placeholder distintos por ação (decisão 24/07): as duas ações são
 * redirects simples para o WhatsApp, sem fluxo de agendamento no produto.
 */
export const MSG_AGENDAR = (iesNome: string): string =>
  `Olá! Sou gestor(a) da ${iesNome} no SanarFlix Academy e quero definir a data de um simulado já contratado.`;

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

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <Card data-testid="cronograma">
      <CardHeader>
        {/* aria-level={2}: o CardTitle do shadcn renderiza <h3> e este card é
            título de primeiro nível da rota, logo abaixo do h1 da saudação —
            sem isso o axe acusa heading-order (§11). Corrigido por ARIA em vez
            de mexer em components/ui/card.tsx, que é compartilhado com as
            experiências de aluno e admin. */}
        <CardTitle className="text-base" aria-level={2}>Cronograma de Simulados</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Só `realizado` tem `resultados_ies_tri` no banco — os outros quatro status
 * abririam o Detalhamento vazio, então navegam desabilitados (§4.7.1, estendido
 * de "previsto/processing" para também cobrir "agendado/reagendado").
 */
function ItemLinha({ item, destaque }: { item: ItemCronograma; destaque: boolean }) {
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
      data-destaque={destaque ? 'true' : 'false'}
      onClick={abrirNoDetalhamento}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors',
        navegavel &&
          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !navegavel && 'cursor-default',
        destaque && 'border border-primary bg-primary/5',
      )}
    >
      <div className="min-w-0">
        {destaque && (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Próximo simulado
          </p>
        )}
        <p className="truncate text-sm font-medium text-foreground">{item.nome}</p>
        <p className="text-xs text-muted-foreground">
          {item.modalidade ? `${ROTULO_DATA[item.modalidade]}: ` : ''}
          {formatData(item.data)}
          {typeof item.participantes === 'number' ? ` · ${item.participantes} participantes` : ''}
        </p>
        {item.indisponivelPorque && (
          <p className="text-xs text-muted-foreground">{item.indisponivelPorque}</p>
        )}
        {semDataRegistrada && (
          <p className="text-xs text-muted-foreground">Data de realização não registrada</p>
        )}
      </div>
      <BadgeStatus status={item.status} />
    </button>
  );
}

/**
 * Cronograma de simulados contratados — âncora da home (spec §2.2, §6.4).
 * O servidor já manda o `status` derivado; este componente só traduz.
 */
export function CronogramaSimulados({ iesId, iesNome }: CronogramaSimuladosProps) {
  const { data, meta, isLoading, isError, refetch } = useCronograma(iesId);

  if (isLoading) {
    return (
      <Moldura>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((linha) => (
            <div key={linha} data-testid="cronograma-skeleton">
              <GestorSkeleton altura={64} rotulo="Carregando cronograma" />
            </div>
          ))}
        </div>
      </Moldura>
    );
  }

  if (isError) {
    return (
      <Moldura>
        <EstadoErro titulo="Não foi possível carregar o cronograma." onRetry={refetch} />
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
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => abrirWhatsApp(MSG_CONSULTOR(iesNome))}
        >
          <MessageCircle aria-hidden="true" />
          Falar com consultor
        </Button>
      </Moldura>
    );
  }

  const previstos = itens.filter((item) => item.status === 'previsto');
  const comData = itens.filter((item) => item.status !== 'previsto');
  const destaqueId = proximoSimulado(itens);

  return (
    <Moldura>
      <ul className="divide-y divide-border">
        {comData.map((item) => (
          <li key={item.id} className="py-1">
            <ItemLinha item={item} destaque={item.id === destaqueId} />
          </li>
        ))}
      </ul>

      {previstos.length > 0 && (
        <div
          data-testid="cronograma-sem-data"
          className="mt-4 rounded-md border border-dashed border-border p-3"
        >
          <p className="text-sm font-medium text-foreground">
            {`Contratados sem data (${previstos.length})`}
          </p>
          <ul className="mt-2 divide-y divide-border">
            {previstos.map((item) => (
              <li key={item.id} className="py-1">
                <ItemLinha item={item} destaque={false} />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => abrirWhatsApp(MSG_AGENDAR(iesNome))}
            >
              <CalendarPlus aria-hidden="true" />
              Agendar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => abrirWhatsApp(MSG_CONSULTOR(iesNome))}
            >
              <MessageCircle aria-hidden="true" />
              Falar com consultor
            </Button>
          </div>
        </div>
      )}

      {meta && (
        <p
          data-testid="cronograma-proveniencia"
          className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground"
        >
          {rotuloVigenciaContrato(meta.periodo)}
        </p>
      )}
    </Moldura>
  );
}
