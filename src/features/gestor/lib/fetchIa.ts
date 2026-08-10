import { supabase } from '@/integrations/supabase/client';
import { env } from '@/config/env';

/**
 * Chamada autenticada às funções de IA do portal.
 *
 * A anon key NUNCA vale como credencial aqui: a função exige um usuário real
 * (`getUser(token)`), então mandar a anon key no `Authorization` devolvia 401 e
 * a tela ficava em branco. Se não houver sessão, falha antes de sair o request;
 * se o token estiver vencido, renova uma vez e repete.
 */
export async function fetchIa(funcao: string, corpo: unknown): Promise<Response> {
  const enviar = async (token: string) =>
    fetch(`${env.EDGE_FUNCTIONS_BASE_URL}/${funcao}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(corpo),
    });

  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error('sem_sessao');

  const resposta = await enviar(token);
  if (resposta.status !== 401) return resposta;

  const { data: renovada } = await supabase.auth.refreshSession();
  const novoToken = renovada.session?.access_token;
  if (!novoToken || novoToken === token) return resposta;
  return enviar(novoToken);
}
