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
import type { ContextoGestor, ItemCronograma } from '@/features/gestor/api/types';

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

/** Próximo simulado = agendado/reagendado com a data mais próxima (§6.4). */
export function proximoSimulado(itens: ItemCronograma[]): string | null {
  const candidatos = itens
    .filter(
      (item) =>
        (item.status === 'agendado' || item.status === 'reagendado') &&
        item.data !== null,
    )
    .sort((a, b) => (a.data as string).localeCompare(b.data as string));

  return candidatos[0]?.id ?? null;
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
  contrato: ContextoGestor['contrato'];
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <Card data-testid="cronograma">
      <CardHeader>
        <CardTitle className="text-base">Cronograma de Simulados</CardTitle>
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
      </div>
      <BadgeStatus status={item.status} />
    </button>
  );
}

/**
 * Cronograma de simulados contratados — âncora da home (spec §2.2, §6.4).
 * O servidor já manda o `status` derivado; este componente só traduz.
 */
export function CronogramaSimulados({ iesId, iesNome, contrato }: CronogramaSimuladosProps) {
  const { data, isLoading, isError, refetch } = useCronograma(iesId);

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

      {contrato && (
        <p
          data-testid="cronograma-proveniencia"
          className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground"
        >
          {`${contrato.nome} · vigência ${contrato.vigencia}`}
        </p>
      )}
    </Moldura>
  );
}
