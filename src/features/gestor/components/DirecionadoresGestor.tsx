import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Icon } from '@/features/gestor/components/Icon';
import { prefetchVisaoGeral } from '@/features/gestor/api/prefetch';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import { GESTOR_V2_NAV } from '@/features/gestor/shell/SidebarNav';
import type { FiltroSemestre } from '@/features/gestor/api/types';

/**
 * Os dois rótulos vêm da nav, não de string literal aqui: o direcionador e o
 * item da sidebar apontam para a mesma tela e precisam dizer o mesmo nome. Foi
 * assim que "Detalhamento por simulados" e "Detalhamento por Simulados"
 * conviveram divergindo em silêncio.
 */
const tituloDaRota = (url: string) => GESTOR_V2_NAV.find((item) => item.url === url)!.title;

const ROTULO_VISAO_GERAL = tituloDaRota('/gestor/visao-geral');
const ROTULO_DETALHAMENTO = tituloDaRota('/gestor/detalhamento');

export interface DirecionadoresGestorProps {
  iesId: string;
  semestre: FiltroSemestre;
}

/**
 * Cartão HORIZONTAL (handoff §4.4): tile de ícone · texto · chevron. O cartão
 * inteiro é o link, então a referência não tem rótulo "Abrir" — o chevron é a
 * afordância inteira, e um CTA em cima de um alvo que já ocupa a linha toda só
 * duplica a mesma ação.
 *
 * Hover (docs/07-motion.md): sobe 1px, a sombra sobe um degrau e a borda vira
 * marca, em `motion-2` (140ms) com a curva padrão. O degrau de sombra exige uma
 * sombra em repouso — sem ela o hover não teria de onde subir.
 *
 * Duração e curva vinham hardcoded (`[transition-duration:140ms]
 * [transition-timing-function:cubic-bezier(0.2,0,0,1)]`, achado da auditoria
 * de movimento de 09/08): mesmo valor de `--gp-motion-2`/`--gp-ease`, mas sem
 * ler o token — se a escala mudasse, este cartão ficaria desalinhado em
 * silêncio. Movidos para `style` (mesmo padrão de `FiltroSemestre.tsx`) em vez
 * de `duration-[var(--gp-motion-2)]`/`ease-[var(--gp-ease)]` no Tailwind
 * arbitrário: sem precedente testado desse padrão neste projeto, e `style`
 * já é usado ao lado (`borderRadius`, `padding`, `gap`) nos dois `<Link>`.
 *
 * Press (comportamento 12): `translateY(0)` (desfaz o hover) + `scale(0.995)`
 * — item que faltava, só havia `:hover`.
 */
const CARTAO =
  'group flex items-center bg-card border border-border ' +
  '[box-shadow:var(--gp-shadow-card)] hover:[box-shadow:0_12px_28px_-14px_hsl(var(--primary)/0.4)] ' +
  'transition-[transform,box-shadow,border-color] ' +
  'hover:-translate-y-px hover:border-primary ' +
  'active:translate-y-0 active:scale-[0.995] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Duração/curva do `CARTAO` — token em vez do valor hardcoded que a auditoria achou. */
const TRANSICAO_CARTAO: React.CSSProperties = {
  transitionDuration: 'var(--gp-motion-2)',
  transitionTimingFunction: 'var(--gp-ease)',
};

/** 48×48, raio 12px: marca no direcionador primário, neutro no secundário (§4.4). */
function TileIcone({ icone, tom }: { icone: DendeIconName; tom: 'marca' | 'neutro' }) {
  return (
    <span
      className="flex flex-none items-center justify-center"
      style={{
        width: 48,
        height: 48,
        borderRadius: 'var(--gp-radius-md)',
        background: tom === 'marca' ? 'var(--gp-brand-surface)' : 'var(--gp-surface-3)',
        // No escuro `--gp-brand` reprova AA sobre a superfície tintada; o par
        // certo é `--gp-brand-on-dark`, que no claro resolve para a própria marca.
        color: tom === 'marca' ? 'var(--gp-brand-on-dark, var(--gp-brand))' : 'var(--gp-text-2)',
      }}
    >
      <Icon name={icone} variant="filled" size={24} />
    </span>
  );
}

function Chevron() {
  return (
    <span className="flex flex-none items-center" style={{ color: 'var(--gp-border-input)' }}>
      <Icon name="chevron_right" size={22} />
    </span>
  );
}

/**
 * Os dois direcionadores que respondem "o que eu faço agora?" (spec §2.1).
 * Hover e foco (não só mouse) aquecem o cache da Visão Geral antes do clique.
 */
export function DirecionadoresGestor({ iesId, semestre }: DirecionadoresGestorProps) {
  const queryClient = useQueryClient();
  const location = useLocation();
  /**
   * `prefetchVisaoGeral` precisa do `user?.id` porque `useEnvelope` insere esse
   * id na queryKey logo após o namespace `'gestor'` (card 107) — sem ele o
   * hover aquece uma chave que a Visão Geral nunca lê. Este componente já roda
   * dentro do `AuthContext` (é filho de `GestorShell`), então lê o id daqui em
   * vez de recebê-lo por prop.
   */
  const { user } = useAuth();
  const aquecer = () => void prefetchVisaoGeral(queryClient, user?.id, iesId, semestre);

  /**
   * Preserva o recorte global (IES + semestre) ao trocar de tela (achados 6
   * e 16 da revisão de 03/08): sem a `search` atual, o destino nasce sem
   * `?ies=`/`?semestre=` e `useFiltrosGestor` degrada pro padrão, ignorando
   * o que a gestora tinha selecionado.
   */
  const comFiltroAtual = (pathname: string) => ({ pathname, search: location.search });

  return (
    /* O overline "O que você quer ver?" NÃO mora aqui: ele rotula a SEÇÃO, e
       quem decide o que a seção mostra é a rota — com a IES ainda não
       resolvida, `Inicio` troca estes cartões por skeletons, e o rótulo tem que
       sobreviver a esse estado. Ele viveu nos dois por um tempo, e a tela
       imprimia a frase duas vezes. */
    <div className="grid gap-4 md:grid-cols-2" data-testid="direcionadores">
        <Link
          to={comFiltroAtual('/gestor/visao-geral')}
          data-testid="direcionador-visao-geral"
          className={CARTAO}
          style={{ borderRadius: 'var(--gp-radius-lg)', padding: 22, gap: 18, ...TRANSICAO_CARTAO }}
          onMouseEnter={aquecer}
          onFocus={aquecer}
        >
          <TileIcone icone="equalizer" tom="marca" />
          <span className="min-w-0 flex-1">
            <span className="block" style={{ fontSize: 16, fontWeight: 700, color: 'var(--gp-text-1)' }}>
              {ROTULO_VISAO_GERAL}
            </span>
            <span
              className="block"
              style={{ fontSize: 13, lineHeight: '19px', marginTop: 3, color: 'var(--gp-text-3)' }}
            >
              Como estamos e onde dói — o panorama da instituição em um recorte só.
            </span>
          </span>
          <Chevron />
        </Link>

        <Link
          to={comFiltroAtual('/gestor/detalhamento')}
          data-testid="direcionador-detalhamento"
          className={CARTAO}
          style={{ borderRadius: 'var(--gp-radius-lg)', padding: 22, gap: 18, ...TRANSICAO_CARTAO }}
        >
          <TileIcone icone="insights" tom="neutro" />
          <span className="min-w-0 flex-1">
            <span className="block" style={{ fontSize: 16, fontWeight: 700, color: 'var(--gp-text-1)' }}>
              {ROTULO_DETALHAMENTO}
            </span>
            <span
              className="block"
              style={{ fontSize: 13, lineHeight: '19px', marginTop: 3, color: 'var(--gp-text-3)' }}
            >
              O que exatamente aconteceu num simulado — questão por questão, aluno por aluno.
            </span>
          </span>
          <Chevron />
        </Link>
    </div>
  );
}
