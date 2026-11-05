import { useMe } from '@/features/mentor/api/queries';
import { InicioB2b } from '@/features/mentor/components/inicio/InicioB2b';
import { InicioB2c } from '@/features/mentor/components/inicio/InicioB2c';

/** Início do Portal do Mentor (docs/handoff/mentor/docs/02 § Tela 1 · 03 § Tela 1). */
export default function Inicio() {
  const me = useMe();
  // O GuardPortalMentor é dono do carregamento e da autorização de `useMe`.
  if (!me.data) return null;
  return me.data.mentor.modalidade === 'b2b' ? <InicioB2b me={me.data} /> : <InicioB2c me={me.data} />;
}
