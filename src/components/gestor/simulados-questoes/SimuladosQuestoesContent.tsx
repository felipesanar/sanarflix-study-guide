import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { FileQuestion, ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { GestorError, GestorEmpty } from '@/experiences/gestor/ui';
import { useInstitutionalQuestionStats } from '@/services/gestor/questionStats';
import { QuestoesErradasList } from './QuestoesErradasList';
import { QuestaoDetailPanel } from './QuestaoDetailPanel';

/** Esqueleto de carregamento no layout de 2 colunas (lista + detalhe) desta tela. */
const SimuladosQuestoesLoading: React.FC = () => (
  <div
    className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr] animate-in fade-in duration-300"
    aria-busy="true"
    aria-live="polite"
  >
    <Skeleton className="h-[520px] rounded-xl" />
    <Skeleton className="h-[520px] rounded-xl" />
  </div>
);

interface SimuladosQuestoesContentProps {
  simuladoId?: string;
  iesId?: string;
  simuladoNome?: string;
}

/**
 * Corpo da tela Simulados & questões: orquestra loading → error → empty →
 * dados para `get_institutional_question_stats` e mantém a seleção local da
 * questão exibida no painel de detalhe (primeira da lista por padrão).
 */
export const SimuladosQuestoesContent: React.FC<SimuladosQuestoesContentProps> = ({
  simuladoId,
  iesId,
  simuladoNome,
}) => {
  const { data, isLoading, isError, refetch } = useInstitutionalQuestionStats(simuladoId, iesId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const questoes = useMemo(() => data ?? [], [data]);

  // Seleciona a primeira questão por padrão quando os dados chegam ou mudam de recorte.
  useEffect(() => {
    if (questoes.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && questoes.some((q) => q.question_id === prev) ? prev : questoes[0].question_id,
    );
  }, [questoes]);

  if (!simuladoId) {
    return (
      <GestorEmpty
        icon={ListChecks}
        title="Selecione um simulado"
        description="Escolha um simulado no recorte acima para ver o caderno de erros da turma."
      />
    );
  }

  if (isLoading) {
    return <SimuladosQuestoesLoading />;
  }

  if (isError) {
    return (
      <GestorError
        message="Não foi possível carregar as estatísticas de questões deste simulado."
        onRetry={() => refetch()}
      />
    );
  }

  if (questoes.length === 0) {
    return (
      <GestorEmpty
        icon={FileQuestion}
        title="Sem respostas registradas"
        description="Ainda não há respostas suficientes registradas para este simulado no recorte selecionado."
      />
    );
  }

  const selected = questoes.find((q) => q.question_id === selectedId) ?? questoes[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <QuestoesErradasList
        simuladoNome={simuladoNome}
        questoes={questoes}
        selectedId={selected.question_id}
        onSelect={setSelectedId}
      />
      <QuestaoDetailPanel questao={selected} />
    </div>
  );
};
