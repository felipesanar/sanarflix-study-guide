import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { useMe } from '@/features/mentor/api/queries';
import { SessoesB2b } from '@/features/mentor/components/sessoes-v2/SessoesB2b';
import { SessoesB2c } from '@/features/mentor/components/sessoes-v2/SessoesB2c';
import '@/features/mentor/components/sessoes-v2/sessoes-v2.css';

/** Sessões (Fase 6.3 B2C · 6.4 B2B). A modalidade vem do mentor logado. */
export default function Sessoes() {
  const me = useMe();
  const dados = me.data;
  if (!dados) return <GestorSkeleton altura={280} rotulo="Carregando sessões" />;
  const { modalidade } = dados.mentor;
  const tribos = dados.tribos.filter((t) => t.modalidade === modalidade);
  const tribo = tribos.find((t) => t.papel === 'titular') ?? tribos[0] ?? null;
  return modalidade === 'b2b' ? <SessoesB2b tribo={tribo} /> : <SessoesB2c />;
}
