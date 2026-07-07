import * as React from 'react';
import { SearchX, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface GestorEmptyProps {
  /** Título curto do estado vazio (ex.: "Em construção", "Sem simulado selecionado"). */
  title: string;
  /** Descrição de apoio. */
  description?: string;
  /** Ícone customizado. @default SearchX */
  icon?: LucideIcon;
  /**
   * Ação opcional (ex.: botão "Selecionar simulado"). Quando for um botão de
   * retry/ação primária, o consumidor deve aplicar o padrão CTA premium do
   * guia (`rounded-xl bg-gradient-to-r from-primary/90 to-primary/80 ...`) —
   * este componente não estiliza o slot, apenas o posiciona.
   */
  action?: React.ReactNode;
}

/**
 * Estado vazio padrão das telas do console de Gestão (sem simulado, IES sem
 * simulados, tela ainda não implementada, etc.) — mesmo padrão visual de
 * `ModuleEmptyState`. Mantém `border-dashed shadow-none` propositalmente
 * (guia de direção visual pede para não trocar por `card-premium` aqui).
 */
export const GestorEmpty: React.FC<GestorEmptyProps> = ({
  title,
  description,
  icon: Icon = SearchX,
  action,
}) => (
  <Card className="border-dashed shadow-none">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </CardContent>
  </Card>
);
