import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMentorContexto } from '@/services/mentor/contexto';

/** Início do mentor — Onda 1: turma e nº de alunos. Alertas entram na Onda 2. */
const InicioMentor: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mentor', 'contexto'],
    queryFn: fetchMentorContexto,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando sua turma…</p>;
  if (isError) return <p className="text-sm text-destructive">Não foi possível carregar sua turma. Tente de novo em instantes.</p>;

  if (!data?.mentor) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Seu cadastro de mentor ainda não foi concluído</h1>
        <p className="text-muted-foreground">Fale com o time de atendimento para vincular sua turma.</p>
      </div>
    );
  }

  const { mentor, alunos_ativos } = data;
  const primeiroNome = mentor.nome.split(' ')[0];

  return (
    <div className="space-y-4">
      <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        {alunos_ativos} {alunos_ativos === 1 ? 'aluno' : 'alunos'} · {mentor.turma_nome}
      </span>
      <h1 className="text-2xl font-semibold">Olá, {primeiroNome}</h1>
      {alunos_ativos === 0 && (
        <p className="text-muted-foreground">Sua turma ainda não tem alunos vinculados.</p>
      )}
    </div>
  );
};

export default InicioMentor;
