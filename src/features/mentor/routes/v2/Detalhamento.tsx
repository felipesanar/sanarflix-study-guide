import { useMe } from '@/features/mentor/api/queries';
import { DetalhamentoPagina } from '@/features/mentor/components/detalhamento-v2/DetalhamentoPagina';

/** Detalhamento por Simulados (B2C e B2B). O shell só renderiza a rota com `useMe` resolvido. */
export default function Detalhamento() {
  const modalidade = useMe().data?.mentor.modalidade;
  if (!modalidade) return null;
  return <DetalhamentoPagina modalidade={modalidade} />;
}
