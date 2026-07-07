import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileQuestion, ListChecks, SearchX } from 'lucide-react';
import { GestorError, GestorEmpty, GestorLoading } from '@/experiences/gestor/ui';
import { useInstitutionalQuestionStats, type QuestionStat } from '@/services/gestor/questionStats';
import { QuestoesErradasList } from './QuestoesErradasList';
import { QuestaoDetailPanel } from './QuestaoDetailPanel';

/** Normaliza para comparação tolerante: lowercase + remove acentos/diacríticos. */
function normalizeTema(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Filtra questões pelo tema da URL: tenta match exato primeiro, com fallback normalizado. */
function filterByTema(questoes: QuestionStat[], tema: string | null): QuestionStat[] {
  if (!tema) return questoes;
  const exact = questoes.filter((q) => q.tema === tema);
  if (exact.length > 0) return exact;
  const normalizedTema = normalizeTema(tema);
  return questoes.filter((q) => q.tema && normalizeTema(q.tema) === normalizedTema);
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

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
  const [searchParams, setSearchParams] = useSearchParams();

  const temaFiltro = searchParams.get('tema');

  const clearTemaFiltro = React.useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('tema');
      return next;
    });
  }, [setSearchParams]);

  const questoes = useMemo(() => data ?? [], [data]);
  const questoesFiltradas = useMemo(
    () => filterByTema(questoes, temaFiltro),
    [questoes, temaFiltro],
  );

  // Seleciona a primeira questão por padrão quando os dados (já filtrados por tema) chegam ou mudam de recorte.
  useEffect(() => {
    if (questoesFiltradas.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && questoesFiltradas.some((q) => q.question_id === prev)
        ? prev
        : questoesFiltradas[0].question_id,
    );
  }, [questoesFiltradas]);

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
    return <GestorLoading metricCards={0} />;
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

  if (temaFiltro && questoesFiltradas.length === 0) {
    return (
      <GestorEmpty
        icon={SearchX}
        title="Nenhuma questão encontrada para este tema"
        description={`Não há questões de "${temaFiltro}" neste recorte. Limpe o filtro para ver todas as questões do simulado.`}
        action={
          <button
            type="button"
            onClick={clearTemaFiltro}
            className="inline-flex items-center rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Limpar filtro de tema
          </button>
        }
      />
    );
  }

  const selected =
    questoesFiltradas.find((q) => q.question_id === selectedId) ?? questoesFiltradas[0];

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
          questoes={questoesFiltradas}
          selectedId={selected.question_id}
          onSelect={setSelectedId}
          temaFiltro={temaFiltro}
          onClearTemaFiltro={clearTemaFiltro}
        />
      </motion.div>
      <motion.div variants={itemVariants} className="min-w-0">
        <QuestaoDetailPanel questao={selected} />
      </motion.div>
    </motion.div>
  );
};
