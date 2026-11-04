/**
 * Montado uma única vez no shell. Abre o drawer do aluno pelo parâmetro `?aluno=<e-mail>` da URL (deep link
 * de qualquer tela: Turma, Visão Geral, Detalhamento, Início) e fecha removendo só esse parâmetro.
 */
import { useSearchParams } from 'react-router-dom';
import { useMe } from '../../api/queries';
import { DrawerAlunoMentor } from './DrawerAlunoMentor';

export const PARAM_ALUNO = 'aluno';

export function DrawerAlunoHost() {
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const email = params.get(PARAM_ALUNO)?.trim().toLowerCase() || null;
  if (!email) return null;
  const fechar = () => setParams((atual) => {
    const proximo = new URLSearchParams(atual);
    proximo.delete(PARAM_ALUNO);
    return proximo;
  }, { replace: true });
  return <DrawerAlunoMentor email={email} modalidade={me.data?.mentor.modalidade} onFechar={fechar} />;
}
