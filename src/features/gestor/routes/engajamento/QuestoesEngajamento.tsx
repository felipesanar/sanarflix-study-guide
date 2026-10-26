import * as React from 'react';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';

/**
 * Aba Questões do Engajamento. Os blocos reais entram nas tarefas B9 e B10;
 * até lá a rota existe, monta dentro do layout e mostra o esqueleto.
 */
export default function QuestoesEngajamento() {
  return (
    <BlocoGestor titulo="Questões" estado="loading" alturaSkeleton={320} bloco="engajamento-questoes">
      {null}
    </BlocoGestor>
  );
}
