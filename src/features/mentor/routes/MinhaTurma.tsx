import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMentorContexto } from '@/services/mentor/contexto';

/** Minha Turma (b2c) / Visão Geral (b2b) — esqueleto da Onda 2. */
const MinhaTurma: React.FC = () => {
  const { data } = useQuery({
    queryKey: ['mentor', 'contexto'],
    queryFn: fetchMentorContexto,
  });
  const titulo = data?.mentor?.tipo === 'b2b' ? 'Visão Geral' : 'Minha Turma';

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="text-sm text-muted-foreground">Em construção.</p>
    </div>
  );
};

export default MinhaTurma;
