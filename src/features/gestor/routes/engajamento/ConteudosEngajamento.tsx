import * as React from 'react';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';

/**
 * Aba Conteúdos do Engajamento. Os blocos reais entram nas tarefas B11 e B12;
 * até lá a rota existe, monta dentro do layout e mostra o esqueleto.
 */
export default function ConteudosEngajamento() {
  return (
    <BlocoGestor titulo="Conteúdos" estado="loading" alturaSkeleton={320} bloco="engajamento-conteudos">
      {null}
    </BlocoGestor>
  );
}
