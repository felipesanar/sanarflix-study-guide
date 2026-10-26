import * as React from 'react';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';

/**
 * Aba Visão geral do Engajamento. Os blocos reais entram nas tarefas B4 a B8;
 * até lá a rota existe, monta dentro do layout e mostra o esqueleto.
 */
export default function VisaoGeralEngajamento() {
  return (
    <BlocoGestor titulo="Visão geral" estado="loading" alturaSkeleton={320} bloco="engajamento-visao-geral">
      {null}
    </BlocoGestor>
  );
}
