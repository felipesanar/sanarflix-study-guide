import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileQuestion, ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { GestorError, GestorEmpty } from '@/experiences/gestor/ui';
import { useInstitutionalQuestionStats } from '@/services/gestor/questionStats';
import { QuestoesErradasList } from './QuestoesErradasList';
import { QuestaoDetailPanel } from './QuestaoDetailPanel';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

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
    <motion.div
      className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="min-w-0">
        <QuestoesErradasList
          simuladoNome={simuladoNome}
          questoes={questoes}
          selectedId={selected.question_id}
          onSelect={setSelectedId}
        />
      </motion.div>
      <motion.div variants={itemVariants} className="min-w-0">
        <QuestaoDetailPanel questao={selected} />
      </motion.div>
    </motion.div>
  );
};
