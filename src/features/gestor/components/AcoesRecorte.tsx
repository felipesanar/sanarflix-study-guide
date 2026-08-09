import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Icon } from '@/features/gestor/components/Icon';
import { useGestorContexto } from '../api/queries';
import { useFiltrosGestor } from '../hooks/useFiltrosGestor';

/**
 * Anatomia comum das duas ações (referência, rodapé do drawer de temas):
 * `border-radius:8px; padding:8px 14px; font-size:12px; font-weight:600;
 * color:#414141; gap:6px`. O que separa as duas é só o COMPORTAMENTO DE
 * BORDA/HOVER — ver as constantes de classe abaixo.
 */
const ESTILO_ACAO: React.CSSProperties = {
  height: 'auto',
  padding: '8px 14px',
  borderRadius: 'var(--gp-radius-sm)',
  fontSize: 12,
  fontWeight: 600,
  gap: 6,
  // `variant="outline"` arrasta `.transition-smooth` (300ms na curva
  // cubic-bezier(0.4,0,0.2,1)): duração fora da escala do portal e curva alheia
  // ao `--gp-ease`. Reescrever aqui é mais barato que mexer no botão
  // compartilhado, e o inline vence a classe sem precisar de `!important`.
  transitionProperty: 'background-color, border-color, color',
  transitionDuration: 'var(--gp-motion-2)',
  transitionTimingFunction: 'var(--gp-ease)',
};

/**
 * Secundária contornada escura. O hover INVERTE a pastilha (fundo escuro, texto
 * branco) — é assim que a referência dá peso ao "Exportar" sem promovê-lo a
 * preenchimento de marca, que na tela inteira aparece uma vez só.
 *
 * As cores saem por classe, não por `style`: hover não existe em estilo inline,
 * e uma `borderColor` inline venceria a classe de hover justamente no estado
 * que precisa mudar.
 */
const CLASSES_SECUNDARIA =
  'border-[color:var(--gp-text-2)] bg-[var(--gp-surface-1)] text-[color:var(--gp-text-2)] ' +
  'hover:border-[color:var(--gp-text-1)] hover:bg-[var(--gp-text-1)] hover:text-[color:var(--gp-text-inverse)]';

/**
 * Terciária. O hover só escurece a BORDA — o `hover:bg-accent` que vem do
 * `variant="outline"` preencheria o fundo e empataria as duas ações.
 */
const CLASSES_TERCIARIA =
  'border-[color:var(--gp-border-input)] bg-[var(--gp-surface-1)] text-[color:var(--gp-text-2)] ' +
  'hover:border-[color:var(--gp-text-2)] hover:bg-[var(--gp-surface-1)] hover:text-[color:var(--gp-text-2)]';

export interface AcoesRecorteProps {
  /** Descrição legível do recorte, ex.: "Pediatria · 6º ano". Vai no cabeçalho do texto copiado. */
  escopo: string;
  /**
   * Texto JÁ AGREGADO do recorte. Spec §7.7: "Copiar resumo" copia texto
   * agregado — nunca lista nominal completa de alunos. A assinatura é a
   * barreira: este componente não recebe lista de alunos e não pode montar uma.
   */
  resumoTexto: string;
  onExportar: () => void;
  /**
   * Loading do "Exportar recorte" (spec §9). Hoje `onExportar` é um no-op com
   * toast de "ainda não disponível" — nada aqui dispara uma ação assíncrona,
   * então esta prop nunca chega `true` na prática. É infraestrutura: quando a
   * exportação de verdade existir, quem chama este componente passa o estado
   * de loading da própria mutação, e o botão já sabe desenhar o spinner sem
   * mudar de largura.
   */
  carregando?: boolean;
}

/**
 * Largura mínima do "Exportar recorte" — reservada para o estado com spinner
 * (spec §9: "botão... mantém a largura, sem salto"). Sem isso, o ícone
 * `download` (15px) trocando pelo spinner (14px) ainda é quase imperceptível,
 * mas a largura do botão passaria a depender do que está montado dentro dele
 * em vez de ser um valor estável — `min-width` fixo é o que a spec pede
 * explicitamente em vez de confiar no acaso dos dois ícones terem tamanho
 * parecido.
 */
const LARGURA_MIN_EXPORTAR = 172;

/** Spinner de botão — o único `animation: linear infinite` permitido no produto (spec §4). */
function SpinnerBotao({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Keyframe da entrada do ícone de "Copiar resumo" — `@keyframes` em vez de
 * `transition` porque a animação precisa disparar sozinha quando o `<span>`
 * MONTA (troca de `key`), sem um segundo render para "chegar" no valor final.
 * Uma `transition` exigiria um estado de React que muda um tick depois do
 * mount (efeito + `requestAnimationFrame`) só para acionar a mudança de
 * propriedade — estado extra que não corresponde a nada visível e que os
 * testes precisariam embrulhar em `act()`. CSS puro evita isso.
 */
const KEYFRAME_ENTRADA_ICONE_COPIAR = `
@keyframes gp-icone-copiar-entrada {
  from { transform: scale(0.8); }
  to { transform: scale(1); }
}
`;

/**
 * Ícone de "Copiar resumo" (spec §20): ao copiar com sucesso, troca para
 * `check` com entrada em `scale(0.8 → 1)` (140ms, curva padrão) e volta ao
 * ícone original 1.6s depois (efeito no componente pai). O `key` força um nó
 * NOVO a cada troca — é o que faz a animação de entrada rodar de novo em
 * cada toggle, inclusive na volta.
 */
function IconeCopiarResumo({ copiado }: { copiado: boolean }) {
  return (
    <>
      <style>{KEYFRAME_ENTRADA_ICONE_COPIAR}</style>
      <span
        key={copiado ? 'check' : 'copy'}
        aria-hidden="true"
        className="inline-flex shrink-0"
        style={{
          animationName: 'gp-icone-copiar-entrada',
          animationDuration: 'var(--gp-motion-2)',
          animationTimingFunction: 'var(--gp-ease)',
          animationFillMode: 'both',
        }}
      >
        <Icon name={copiado ? 'check' : 'content_copy'} size={15} />
      </span>
    </>
  );
}

/**
 * Rodapé de ações dos drawers de recorte (temas e aluno) — Task 45b/45.5.
 *
 * Hierarquia (referência §5): o par é SECUNDÁRIO + TERCIÁRIO, nunca primário.
 * "Exportar recorte" era um botão de marca preenchido e dominava o rodapé como
 * se fosse o CTA da tela; na referência o preenchimento sólido de marca aparece
 * uma única vez, em "Selecionar simulado". Exportar um recorte é ação
 * secundária de um recorte.
 *
 * Gate (spec §3 e §7.7): quando o papel não pode exportar (`podeExportar`,
 * decidido no SERVIDOR via `useGestorContexto`, nunca por role lido no
 * cliente — mesmo padrão de `podeTrocarIes` em `SidebarIes`), as ações ficam
 * AUSENTES — não desabilitadas. Um controle desabilitado com tooltip
 * anunciaria uma funcionalidade que a IES não contratou; aqui o componente
 * simplesmente não renderiza nada.
 */
export function AcoesRecorte({
  escopo,
  resumoTexto,
  onExportar,
  carregando = false,
}: AcoesRecorteProps) {
  const { data: contexto } = useGestorContexto();
  const { iesId } = useFiltrosGestor();
  const { toast } = useToast();
  const [copiado, setCopiado] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Limpa o timer de "voltar ao ícone original" se o componente desmontar
  // (drawer fechado) antes dos 1.6s — spec pede o cleanup explicitamente.
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!contexto?.podeExportar) return null;

  const copiar = async () => {
    /**
     * `contexto.iesAtual` é a IES de CADASTRO do usuário e não acompanha a
     * troca no dropdown (achados 1 e 2 da revisão de 04/08) — `get_gestor_contexto()`
     * não recebe `p_ies_id` e a query não é reconsultada quando o gestor troca
     * de IES. O nome precisa vir da IES do RECORTE (mesma leitura de URL que
     * `VisaoGeral` usa para os dados), resolvida contra `iesDisponiveis` —
     * mesmo padrão já usado em `SaudacaoGestor.tsx` e `Inicio.tsx`.
     */
    const iesFocoId = iesId ?? contexto.iesAtual.id;
    const nomeIes =
      contexto.iesDisponiveis.find((ies) => ies.id === iesFocoId)?.nome ?? contexto.iesAtual.nome;
    const cabecalho = `${nomeIes} · ${escopo}`;
    try {
      await navigator.clipboard.writeText(`${cabecalho}\n${resumoTexto}`);
      toast({ description: 'Resumo copiado.' });
      setCopiado(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast({
        variant: 'destructive',
        description: 'Não foi possível copiar. Tente novamente.',
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onExportar}
        disabled={carregando}
        className={CLASSES_SECUNDARIA}
        style={{ ...ESTILO_ACAO, minWidth: LARGURA_MIN_EXPORTAR }}
      >
        {carregando ? <SpinnerBotao size={14} /> : <Icon name="download" size={15} />}
        Exportar recorte
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copiar}
        className={CLASSES_TERCIARIA}
        style={ESTILO_ACAO}
      >
        <IconeCopiarResumo copiado={copiado} />
        Copiar resumo
      </Button>
    </div>
  );
}
