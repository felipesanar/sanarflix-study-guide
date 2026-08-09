import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Icon } from '@/features/gestor/components/Icon';
import { useGestorContexto } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';

/**
 * Altura do cartão de IES: 9px de padding + o tile de 30px + 9px. É a MESMA
 * nos dois desfechos (dropdown e rótulo estático) e no skeleton — sem isso a
 * sidebar encolhia quando `get_gestor_contexto` respondia, justamente no papel
 * majoritário (`gestor`), que é o do rótulo estático.
 */
const ALTURA_CARTAO = 48;

/** Caixa do cartão, partilhada pelas três ramificações. */
const CARTAO: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 11px',
  minHeight: ALTURA_CARTAO,
  borderRadius: 'var(--gp-radius-sm)',
};

/**
 * Shimmer do skeleton do cartão — os MESMOS tokens `--gp-skeleton`/
 * `--gp-skeleton-brilho` (calibrados nos dois temas em `gestor-theme.css`) e o
 * MESMO gradiente que `GestorSkeleton.tsx` usa. Duplicado em vez de
 * reaproveitado: `GestorSkeleton` sempre embrulha o resultado num `role`
 * `status` próprio (`forma="bloco"` × 2 renderizaria DOIS `role="status"`
 * dentro do cartão, e o teste/leitor de tela só quer UM "Carregando
 * instituição" por cartão) — replicar o gradiente aqui é o caminho mais
 * simples que a Onda 2/B1 deixou em aberto para este caso.
 */
const SHIMMER: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--gp-skeleton) 25%, var(--gp-skeleton-brilho) 50%, var(--gp-skeleton) 75%)',
  backgroundSize: '200% 100%',
};

/** Partículas que não entram na sigla — "Fac. de Medicina" vira "FM", não "FD". */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para']);

/** Sigla de até 2 letras da IES, para o tile do cartão. */
const iniciaisDaIes = (nome: string): string =>
  nome
    .split(/\s+/)
    .filter((parte) => parte && !PARTICULAS.has(parte.toLowerCase()))
    .slice(0, 2)
    .map((parte) => (parte.match(/\p{L}/u)?.[0] ?? '').toUpperCase())
    .join('');

/**
 * Tile de 30px com a sigla da IES. No claro é a tinta neutra mais escura; no
 * escuro é a marca — é o que a referência faz nos dois temas, e é também o que
 * mantém a sigla legível quando a superfície inverte.
 */
const TileIes: React.FC<{ nome: string }> = ({ nome }) => (
  <span
    aria-hidden="true"
    className="flex shrink-0 items-center justify-center bg-[color:var(--gp-text-1)] dark:bg-[color:var(--gp-brand)]"
    style={{
      width: 30,
      height: 30,
      borderRadius: 'var(--gp-radius-sm)',
      fontSize: 11,
      fontWeight: 700,
      /**
       * `lineHeight: 1` é o que centra a sigla de verdade.
       *
       * `align-items: center` centra a CAIXA DE LINHA, não o desenho da letra.
       * Com o `line-height: normal` da Inter (≈1.21em: 0.969 de ascendente +
       * 0.241 de descendente), a caixa tem folga assimétrica em torno de uma
       * palavra só de maiúsculas — sobra o vão do descendente embaixo e a
       * sigla sobe. Em 1em a meia-entrelinha fica negativa e simétrica: o topo
       * da maiúscula cai a 0.137em do topo da caixa e a base a 0.136em do
       * fundo — centrada por construção, sem nudge mágico.
       */
      lineHeight: 1,
      color: 'var(--gp-text-inverse)',
    }}
  >
    {iniciaisDaIes(nome)}
  </span>
);

/** Tipografia do nome da IES dentro do cartão. */
const NOME_IES: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  lineHeight: '15px',
  color: 'var(--gp-text-1)',
};

/**
 * Instituição em foco na sidebar (spec §3).
 *
 * `admin` e `gestor_grupo` trocam de IES por dropdown; `gestor` vê o mesmo
 * cartão como rótulo estático — sem borda, sem chevron, sem afordância de
 * clique e sem controle desabilitado.
 *
 * O switch é `podeTrocarIes`, decidido no servidor: nenhum componente checa
 * role literal. E o `iesId` na URL é hint de UI — a autorização é da RPC.
 *
 * Não há rótulo "Instituição" acima do cartão: a referência não o tem na
 * sidebar (a palavra só aparece no hero da folha de handoff). O nome acessível
 * do controle vem do `aria-label` do gatilho.
 */
export const SidebarIes: React.FC = () => {
  const { data: contexto, isLoading } = useGestorContexto();
  const { iesId, setIesId, setSimulados } = useFiltrosGestor();
  const container = useGestorPortalContainer();

  /**
   * Regra dos 400ms (spec de motion §7, `useDelayedLoading.ts`): antes disto
   * o skeleton do cartão aparecia no INSTANTE em que `isLoading` virava
   * `true` — num acesso com rede boa, `get_gestor_contexto` costuma responder
   * bem antes disso, e o flash de skeleton só fazia o cartão parecer
   * instável. `mostrarSkeleton` só vira `true` se `isLoading` permanecer
   * assim por mais de 400ms.
   */
  const mostrarSkeleton = useDelayedLoading(isLoading);

  // `?ies=` só é aceito se apontar para uma IES que a pessoa de fato acessa.
  // Sem essa validação, um link colável para uma IES fora do escopo (ou um
  // bookmark de um gestor_grupo cuja IES saiu do grupo) deixaria o `<Select>`
  // com um `value` sem `SelectItem` correspondente — seletor em branco, sem
  // caminho de saída (achado 17). A autorização de fato é da RPC; isto é só
  // para a UI nunca ficar num estado sem saída.
  const iesValida = contexto ? contexto.iesDisponiveis.some((ies) => ies.id === iesId) : false;

  // Semeia (ou corrige) o recorte global com a IES do contexto assim que ele
  // chega, sempre que a URL não tiver uma seleção válida — seja porque `iesId`
  // ainda é `null` no primeiro acesso (achado do Felipe, item 3a: sem isso
  // nenhum hook de dado como useCronograma/useVisaoGeral dispara, porque todos
  // são `enabled: iesId !== null`), seja porque aponta para uma IES fora do
  // escopo (achado 17). Cai para `contexto.iesAtual.id`, que é sempre uma das
  // opções do dropdown — nunca deixa a pessoa sem seletor utilizável. Termina
  // em uma escrita: depois da correção `iesValida` passa a `true` e o efeito
  // não corre de novo, sem risco de loop.
  React.useEffect(() => {
    if (contexto && !iesValida) {
      setIesId(contexto.iesAtual.id);
    }
  }, [contexto, iesValida, setIesId]);

  /**
   * Troca deliberada de IES pelo dropdown — e SÓ ela. Os ids em `?simulados=`
   * pertencem ao cronograma da IES anterior: preservá-los deixava a nova IES
   * montando todos os blocos sobre uma seleção inexistente — nenhum chip
   * marcado no `SeletorSimulados` e, pior, nenhum estado vazio, porque
   * `selecionados.length === 0` continuava falso. Limpar aqui devolve a tela
   * ao "Escolha ao menos um simulado" de docs/05 §Vazio.
   *
   * Duas escritas no mesmo tick são seguras: `useFiltrosGestor` encadeia pelo
   * próprio `paramsRef` (ver o teste "duas escritas no mesmo tick não se
   * perdem"). O efeito de semeadura acima NÃO passa por aqui de propósito —
   * ele corrige a URL, não é uma troca de recorte pedida pela pessoa.
   */
  const trocarIes = React.useCallback(
    (id: string) => {
      setIesId(id);
      setSimulados([]);
    },
    [setIesId, setSimulados],
  );

  if (mostrarSkeleton) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Carregando instituição"
        className="flex flex-col justify-center"
        style={{ height: ALTURA_CARTAO, padding: '9px 11px', gap: 6, borderRadius: 'var(--gp-radius-sm)' }}
      >
        {/* Nome da IES: 13px de altura, 70% de largura. */}
        <div
          className="animate-shimmer"
          style={{ height: 13, width: '70%', borderRadius: 'var(--gp-radius-pill)', ...SHIMMER }}
        />
        {/* Linha de contexto (papel/afiliação) sob o nome: 10px/50%. */}
        <div
          className="animate-shimmer"
          style={{ height: 10, width: '50%', borderRadius: 'var(--gp-radius-pill)', ...SHIMMER }}
        />
      </div>
    );
  }

  if (!contexto) return null;

  if (!contexto.podeTrocarIes) {
    return (
      <div style={CARTAO}>
        <TileIes nome={contexto.iesAtual.nome} />
        <p className="min-w-0 flex-1 truncate" style={NOME_IES} title={contexto.iesAtual.nome}>
          {contexto.iesAtual.nome}
        </p>
      </div>
    );
  }

  // `iesId` (URL) é a fonte de verdade da seleção. `contexto.iesAtual` NÃO
  // acompanha a troca — `get_gestor_contexto()` não recebe `p_ies_id` e não é
  // reconsultado quando o usuário muda de IES — então usá-lo aqui prenderia o
  // rótulo do dropdown na primeira IES para sempre (achado do Felipe, item
  // 3b). Cai em `iesAtual` quando não há seleção válida ainda: `iesId` nulo no
  // primeiro acesso, ou fora de `iesDisponiveis` (achado 17) — em ambos os
  // casos só até o efeito de correção rodar.
  const iesSelecionada = iesValida ? iesId ?? contexto.iesAtual.id : contexto.iesAtual.id;
  const nomeSelecionado =
    contexto.iesDisponiveis.find((ies) => ies.id === iesSelecionada)?.nome ??
    contexto.iesAtual.nome;

  return (
    <Select value={iesSelecionada} onValueChange={trocarIes}>
      <SelectTrigger
        aria-label="Instituição em foco"
        // `h-auto` e `[&>span]:line-clamp-none` desfazem o gatilho genérico do
        // shadcn (40px de altura fixa e clamp em todo span filho, que
        // quebraria o flex do tile). O resto da caixa — borda, raio, padding —
        // vem do `style`, que vence as classes utilitárias sem depender de
        // ordem de cascata.
        className="h-auto w-full [&>span]:line-clamp-none"
        style={{ ...CARTAO, border: '1px solid var(--gp-border-strong)' }}
        icon={<Icon name="expand_more" size={16} className="text-[color:var(--gp-text-3)]" />}
      >
        <TileIes nome={nomeSelecionado} />
        <span className="min-w-0 flex-1 truncate text-left" style={NOME_IES}>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent container={container}>
        {contexto.iesDisponiveis.map((ies) => (
          <SelectItem key={ies.id} value={ies.id}>
            {ies.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
