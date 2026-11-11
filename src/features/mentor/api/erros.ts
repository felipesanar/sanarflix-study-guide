/**
 * Erros da camada de dados do Mentor → mensagem e tratamento na UI
 * (docs/handoff/mentor/docs/07-integracao-flix.md § Conexão).
 *
 * As três fontes lançam `ErroFonte` com o mesmo vocabulário de `code`:
 *  - `validacao`: o `message` vem pronto da API (Flix) ou do RAISE (Academy); vai inline no `field`;
 *  - `sem_acesso_tribo`, `mentor_sem_agenda`, `convite_ativo`, `aluno_fora_da_tribo`, `canal_nao_editavel`;
 *  - `mentor_sem_cadastro`: papel mentor sem cadastro concluído (Academy);
 *  - `rede` (ou qualquer 5xx): estado de erro no bloco + "Tentar novamente"; o resultado pode ser incerto.
 */
import { ErroFonte } from './fonte';

export const MENSAGENS_ERRO = {
  sem_acesso_tribo: 'Você não tem acesso a esta turma.',
  canal_nao_editavel: 'Este canal não pode ser editado.',
  mentor_sem_agenda: 'Cadastre seu link do Google Agenda no perfil para liberar agendamentos.',
  convite_ativo: 'A agenda deste aluno já está liberada.',
  aluno_fora_da_tribo: 'Um dos alunos não está mais na turma. Atualize a lista.',
  mentor_sem_cadastro: 'Seu cadastro de mentor ainda não foi concluído.',
  token_invalido: 'Sua sessão expirou. Entre de novo para continuar.',
  nao_encontrado: 'Este item não existe mais. Atualize a página.',
  mentor_sem_vinculo_flix: 'Seu cadastro de mentor ainda não está ligado ao Flix. Fale com o administrador.',
  chave_reutilizada: 'Esta ação já foi enviada. Atualize a página para ver o resultado.',
  limite_requisicoes: 'Muitas ações em pouco tempo. Aguarde um minuto e tente de novo.',
  flix_indisponivel: 'A mentoria está temporariamente indisponível. Tente de novo em instantes.',
  rede: 'Não foi possível carregar agora. Tente novamente.',
  desconhecido: 'Algo deu errado. Tente de novo.',
} as const;

/** Como a tela deve apresentar o erro (docs/07 § Conexão, coluna "Mensagem na UI"). */
export type TratamentoErro = 'inline' | 'faixa' | 'toast' | 'recarregar' | 'estado_erro';

/** Mensagem pronta para a UI. Nunca expõe texto técnico de rede. */
export function mensagemErro(e: unknown): string {
  if (!(e instanceof ErroFonte)) return MENSAGENS_ERRO.desconhecido;
  if (e.code === 'validacao') return e.message?.trim() || MENSAGENS_ERRO.desconhecido;
  if (e.code === 'flix_indisponivel') return MENSAGENS_ERRO.flix_indisponivel;
  if (e.status >= 500) return MENSAGENS_ERRO.rede;
  if (e.code in MENSAGENS_ERRO) return MENSAGENS_ERRO[e.code as keyof typeof MENSAGENS_ERRO];
  return MENSAGENS_ERRO.desconhecido;
}

export function tratamentoErro(e: unknown): TratamentoErro {
  if (!(e instanceof ErroFonte)) return 'estado_erro';
  if (e.status >= 500) return 'estado_erro';
  switch (e.code) {
    case 'validacao':
    case 'mentor_sem_agenda':
      return 'inline';
    case 'sem_acesso_tribo':
    case 'mentor_sem_cadastro':
      return 'faixa';
    case 'aluno_fora_da_tribo':
      return 'toast';
    case 'convite_ativo':
      return 'recarregar';
    default:
      return 'estado_erro';
  }
}

/** Campo do formulário que recebe o erro inline (só `validacao` da API traz `field`). */
export function campoDoErro(e: unknown): string | null {
  return e instanceof ErroFonte && e.code === 'validacao' ? e.field ?? null : null;
}

/** ID para a tela apresentar como "Código: ...", separado da mensagem. */
export function codigoDeSuporte(erro: unknown): string | null {
  return erro instanceof ErroFonte ? erro.requestId ?? null : null;
}
