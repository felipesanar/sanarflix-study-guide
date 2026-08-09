import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icon } from '@/features/gestor/components/Icon';
import { useGestorContexto } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';
import {
  ALTURA_CARTAO,
  CARTAO,
  CONTEXTO_IES,
  NOME_IES,
  SHIMMER,
  TileIes,
  iniciaisDaIes,
  normalizar,
} from '@/features/gestor/shell/ies/cartao';
import { lerRecentes, registrarRecente } from '@/features/gestor/shell/ies/recentes';

/**
 * Instituição em foco na sidebar (spec §3).
 *
 * Quem pode trocar de IES (`podeTrocarIes`, decidido no servidor) abre um
 * painel de busca; quem tem uma só vê o mesmo cartão como rótulo — sem borda de
 * campo, sem chevron, sem afordância de clique e sem controle desabilitado.
 *
 * O switch é sempre `podeTrocarIes`: nenhum comportamento aqui olha papel
 * literal (o papel só escolhe a FRASE da linha de contexto). E o `iesId` na URL
 * é hint de UI — a autorização é da RPC.
 */

/** Acima disto a lista não cabe na tela sem busca — e sem busca é inutilizável. */
const LIMIAR_BUSCA = 8;

/** Superfície de um item do painel, por estado. */
const itemStyle = (ativo: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '7px 9px',
  borderRadius: 'var(--gp-radius-sm)',
  cursor: 'pointer',
  background: ativo ? 'var(--gp-brand-surface-subtle)' : 'transparent',
});

/* Os títulos de grupo do painel são estilizados por `[cmdk-group-heading]` em
   `gestor-theme.css` — o cmdk renderiza esse nó por conta própria. */



/** Uma linha da lista: tile, nome e marca de selecionada. */
const ItemIes: React.FC<{
  ies: { id: string; nome: string };
  selecionada: boolean;
  onSelecionar: (id: string) => void;
}> = ({ ies, selecionada, onSelecionar }) => (
  <CommandPrimitive.Item
    value={`${ies.nome} ${iniciaisDaIes(ies.nome)} ${ies.id}`}
    onSelect={() => onSelecionar(ies.id)}
    className="gp-ies-item"
    style={itemStyle(selecionada)}
  >
    <TileIes nome={ies.nome} tamanho={26} />
    <span
      className="min-w-0 flex-1 truncate"
      style={{ ...NOME_IES, fontWeight: selecionada ? 700 : 500 }}
      title={ies.nome}
    >
      {ies.nome}
    </span>
    {selecionada ? (
      <Icon name="check" size={16} className="shrink-0 text-[color:var(--gp-brand)]" />
    ) : null}
  </CommandPrimitive.Item>
);

export const SidebarIes: React.FC = () => {
  const { data: contexto, isLoading, isError, refetch } = useGestorContexto();
  const { iesId, setIesId, setSimulados } = useFiltrosGestor();
  const container = useGestorPortalContainer();

  const [aberto, setAberto] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const [trocando, setTrocando] = React.useState(false);
  const [anuncio, setAnuncio] = React.useState('');
  const [recentes, setRecentes] = React.useState<string[]>([]);

  /**
   * Regra dos 400ms (spec de motion §7): antes disto o skeleton aparecia no
   * instante em que `isLoading` virava `true` e, com rede boa, só fazia o
   * cartão parecer instável.
   */
  const mostrarSkeleton = useDelayedLoading(isLoading);

  const usuarioId = contexto?.usuario.id ?? null;
  React.useEffect(() => {
    if (usuarioId) setRecentes(lerRecentes(usuarioId));
  }, [usuarioId]);

  // `?ies=` só é aceito se apontar para uma IES que a pessoa de fato acessa.
  // Sem isso, um link colável para uma IES fora do escopo deixaria o seletor
  // com um valor sem item correspondente — sem caminho de saída (achado 17).
  const iesValida = contexto ? contexto.iesDisponiveis.some((ies) => ies.id === iesId) : false;

  // Semeia (ou corrige) o recorte global com a IES do contexto assim que ele
  // chega, sempre que a URL não tiver seleção válida: sem isso nenhum hook de
  // dado dispara (todos são `enabled: iesId !== null`). Termina em uma escrita:
  // depois `iesValida` passa a `true` e o efeito não corre de novo.
  React.useEffect(() => {
    if (contexto && !iesValida) {
      setIesId(contexto.iesAtual.id);
    }
  }, [contexto, iesValida, setIesId]);

  /**
   * Troca deliberada de IES — e SÓ ela. Os ids em `?simulados=` pertencem ao
   * cronograma da IES anterior: preservá-los deixava a tela montando todos os
   * blocos sobre uma seleção inexistente, sem chip marcado e sem estado vazio.
   * O efeito de semeadura acima NÃO passa por aqui de propósito: ele corrige a
   * URL, não é uma troca pedida pela pessoa.
   */
  const trocarIes = React.useCallback(
    (id: string, nome: string) => {
      setIesId(id);
      setSimulados([]);
      setAberto(false);
      setBusca('');
      setAnuncio(`Instituição alterada para ${nome}`);
      if (usuarioId) setRecentes(registrarRecente(usuarioId, id));
      // Estado ocupado curto: o painel fecha na hora e o cartão assume o nome
      // novo com um spinner discreto, para a troca não parecer que "não fez
      // nada" enquanto as rotas remontam.
      setTrocando(true);
      window.setTimeout(() => setTrocando(false), 600);
    },
    [setIesId, setSimulados, usuarioId],
  );

  if (mostrarSkeleton) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Carregando instituição"
        style={{ ...CARTAO }}
      >
        <div
          className="animate-shimmer shrink-0"
          style={{ width: 32, height: 32, borderRadius: 'var(--gp-radius-sm)', ...SHIMMER }}
        />
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 6 }}>
          <div
            className="animate-shimmer"
            style={{ height: 12, width: '78%', borderRadius: 'var(--gp-radius-pill)', ...SHIMMER }}
          />
          <div
            className="animate-shimmer"
            style={{ height: 9, width: '46%', borderRadius: 'var(--gp-radius-pill)', ...SHIMMER }}
          />
        </div>
      </div>
    );
  }

  /**
   * Erro: antes disto `!contexto` renderizava `null` e a sidebar ficava com um
   * vão sem explicação nem saída. Agora há mensagem e retentativa.
   */
  if (isError && !contexto) {
    return (
      <div
        style={{
          ...CARTAO,
          alignItems: 'flex-start',
          flexDirection: 'column',
          gap: 6,
          border: '1px solid var(--gp-border-strong)',
        }}
      >
        <p style={{ ...CONTEXTO_IES, color: 'var(--gp-text-2)' }}>
          Não foi possível carregar a instituição
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-1 hover:underline"
          style={{ ...CONTEXTO_IES, color: 'var(--gp-brand)', fontWeight: 700 }}
        >
          <Icon name="refresh" size={13} />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!contexto) return null;

  const opcoes = contexto.iesDisponiveis;

  // `iesId` (URL) é a fonte de verdade da seleção. `contexto.iesAtual` NÃO
  // acompanha a troca — `get_gestor_contexto()` não recebe `p_ies_id` e não é
  // reconsultado — então usá-lo aqui prenderia o rótulo na primeira IES para
  // sempre.
  const iesSelecionada = iesValida ? iesId ?? contexto.iesAtual.id : contexto.iesAtual.id;
  const nomeSelecionado =
    opcoes.find((ies) => ies.id === iesSelecionada)?.nome ?? contexto.iesAtual.nome;

  /**
   * Linha de contexto. O papel entra APENAS como escolha de frase — nenhuma
   * decisão de comportamento depende dele (o switch é `podeTrocarIes`).
   */
  const linhaContexto = !contexto.podeTrocarIes
    ? contexto.contrato?.nome ?? 'Instituição do seu acesso'
    : contexto.usuario.papel === 'admin'
      ? 'Todas as instituições'
      : `Grupo · ${opcoes.length} instituições`;

  if (!contexto.podeTrocarIes) {
    return (
      <div style={CARTAO}>
        <TileIes nome={nomeSelecionado} />
        <div className="min-w-0 flex-1">
          <p className="truncate" style={NOME_IES} title={nomeSelecionado}>
            {nomeSelecionado}
          </p>
          <p className="truncate" style={CONTEXTO_IES}>
            {linhaContexto}
          </p>
        </div>
      </div>
    );
  }

  const idsRecentes = recentes.filter(
    (id) => id !== iesSelecionada && opcoes.some((ies) => ies.id === id),
  );
  const listaRecentes = idsRecentes
    .map((id) => opcoes.find((ies) => ies.id === id))
    .filter((ies): ies is { id: string; nome: string } => Boolean(ies));
  const demais = opcoes.filter((ies) => !idsRecentes.includes(ies.id));

  return (
    <>
      <Popover open={aberto} onOpenChange={setAberto}>

        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-label="Instituição em foco"
            aria-expanded={aberto}
            className="gp-ies-trigger w-full text-left transition-colors"
            style={{
              ...CARTAO,
              border: '1px solid var(--gp-border-strong)',
              background: aberto ? 'var(--gp-surface-2)' : 'transparent',
            }}
          >
            <TileIes nome={nomeSelecionado} />
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={NOME_IES}>
                {nomeSelecionado}
              </span>
              <span className="block truncate" style={CONTEXTO_IES}>
                {trocando ? 'Carregando dados…' : linhaContexto}
              </span>
            </span>
            {trocando ? (
              <Icon
                name="refresh"
                size={16}
                className="shrink-0 animate-spin text-[color:var(--gp-text-3)]"
              />

            ) : (
              <Icon
                name="unfold_more"
                size={16}
                className="shrink-0 text-[color:var(--gp-text-3)]"
              />
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          container={container}
          align="start"
          sideOffset={6}
          className="p-0"
          style={{
            width: 288,
            background: 'var(--gp-surface-1)',
            border: '1px solid var(--gp-border-strong)',
            borderRadius: 'var(--gp-radius-md)',
            boxShadow: 'var(--gp-shadow-card)',
          }}
        >
          <CommandPrimitive label="Trocar de instituição" loop>
            <CommandPrimitive.List
              className="overflow-y-auto overscroll-contain"
              style={{ maxHeight: 288, padding: 6 }}
            >
              {listaRecentes.length > 0 ? (
                <CommandPrimitive.Group heading="Recentes" style={{ marginBottom: 2 }}>
                  {listaRecentes.map((ies) => (
                    <ItemIes
                      key={ies.id}
                      ies={ies}
                      selecionada={false}
                      onSelecionar={() => trocarIes(ies.id, ies.nome)}
                    />
                  ))}
                </CommandPrimitive.Group>
              ) : null}

              <CommandPrimitive.Group
                heading={listaRecentes.length > 0 ? 'Todas as instituições' : undefined}
              >
                {demais.map((ies) => (
                  <ItemIes
                    key={ies.id}
                    ies={ies}
                    selecionada={ies.id === iesSelecionada}
                    onSelecionar={() => trocarIes(ies.id, ies.nome)}
                  />
                ))}
              </CommandPrimitive.Group>
            </CommandPrimitive.List>

            <p
              style={{
                ...CONTEXTO_IES,
                padding: '8px 12px',
                borderTop: '1px solid var(--gp-border-subtle)',
              }}
            >
              {opcoes.length === 1
                ? '1 instituição disponível'
                : `${opcoes.length} instituições disponíveis`}
            </p>
          </CommandPrimitive>
        </PopoverContent>
      </Popover>

      {/* Troca de recorte é mudança de contexto: precisa ser anunciada. */}
      <span className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </span>
    </>
  );
};

/** Reexportado para quem media a estabilidade de altura da sidebar. */
export { ALTURA_CARTAO };
