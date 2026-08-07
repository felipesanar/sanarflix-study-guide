import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  SOMENTE_FILLED,
  SOMENTE_OUTLINED,
  classeDoIcone,
  type DendeIconName,
  type DendeIconVariant,
} from '@/features/gestor/components/icon-names';

export interface IconProps {
  /** Nome do glifo no Fontello do Dendê. Nome inexistente é erro de compilação. */
  name: DendeIconName;
  /**
   * Gramática do handoff §3: `filled` = ativo/selecionado, `outlined` = default.
   * O default é `outlined` justamente porque a maioria dos ícones da UI está em
   * repouso — quem está ativo é a exceção e deve dizer isso explicitamente.
   */
  variant?: DendeIconVariant;
  /** Aresta do glifo em px. O handoff especifica o tamanho por contexto (§3). */
  size: number;
  /**
   * Largura da caixa óptica ao redor do glifo, em px. O handoff §3 exige que o
   * ícone viva num span de largura fixa centralizado — 20px na sidebar — para
   * que rótulos de itens diferentes alinhem mesmo com glifos de larguras
   * diferentes. Sem `box`, o glifo é renderizado solto e alinha pela linha.
   */
  box?: number;
  /**
   * Rótulo acessível. Com ele o ícone vira `role="img"` + `aria-label` — para
   * ícone que carrega significado sozinho (botão só-de-ícone). Sem ele (o
   * padrão, e o caso da maioria, que acompanha texto), fica `aria-hidden`.
   */
  label?: string;
  className?: string;
}

/**
 * Ícone do Portal do Gestor.
 *
 * O handoff §3 é categórico: **100% dos ícones vêm da fonte Fontello do Dendê**.
 * Nenhum SVG avulso, nenhum Lucide/Heroicons/Material, nenhum emoji. Glifo que
 * faltar é adicionado ao Fontello, nunca substituído por outra família — por
 * isso `name` é um union fechado gerado da própria fonte: pedir um ícone que
 * não existe não compila, em vez de renderizar tofu em produção.
 *
 * A cor vem por `color` (o glifo herda `currentColor`) e o tamanho por
 * `font-size`, como manda a mecânica de icon-font.
 */
export function Icon({ name, variant = 'outlined', size, box, label, className }: IconProps) {
  if (import.meta.env.DEV) {
    const indisponivel =
      (variant === 'outlined' && SOMENTE_FILLED.has(name)) ||
      (variant === 'filled' && SOMENTE_OUTLINED.has(name));
    if (indisponivel) {
      // Cai para a variante existente em vez de renderizar tofu, mas avisa:
      // um par filled/outlined incompleto costuma ser lacuna da fonte, e o
      // handoff manda adicionar o glifo ao Fontello, não trocar de família.
      console.warn(
        `[Icon] "${name}" não tem a variante "${variant}" no Fontello do Dendê. ` +
          `Usando a variante disponível. Adicione o glifo à fonte em vez de trocar de ícone.`,
      );
    }
  }

  const a11y = label === undefined ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label };

  const glifo = (
    <i
      {...(box === undefined ? a11y : { 'aria-hidden': true as const })}
      className={cn(classeDoIcone(name, variant), box === undefined && className)}
      style={{ fontSize: size, lineHeight: 1 }}
    />
  );

  if (box === undefined) return glifo;

  return (
    <span
      {...a11y}
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: box, height: box }}
    >
      {glifo}
    </span>
  );
}
