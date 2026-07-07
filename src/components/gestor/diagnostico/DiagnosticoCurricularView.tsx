import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  SectionHeader,
  GestorLoading,
  GestorError,
  GestorEmpty,
  GestorTriPending,
  GestorDemoBadge,
} from '@/experiences/gestor/ui';
import type { InstitutionalViewModel } from '@/types/desempenhoV2';
import { DiagnosticoBreadcrumb } from './DiagnosticoBreadcrumb';
import { CurricularDrillList } from './CurricularDrillList';
import { AccuracyEvolutionCard } from './AccuracyEvolutionCard';
import {
  toAreaRow,
  toEspecialidadeRow,
  toTemaRow,
  type DiagnosticoDrillState,
  type DrillRowItem,
} from './types';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface DiagnosticoCurricularViewProps {
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  usingMock: boolean;
  iesId?: string;
  simuladoNome?: string;
}

/**
 * Tela Diagnóstico curricular do console de Gestão — drill-down Exame →
 * Grandes áreas → Especialidades → Temas sobre `curricular` do
 * `InstitutionalViewModel`, com card de evolução de acurácia do recorte
 * ativo e CTA para o simulador de impacto.
 */
export const DiagnosticoCurricularView: React.FC<DiagnosticoCurricularViewProps> = ({
  data,
  loading,
  error,
  onRetry,
  usingMock,
  iesId,
  simuladoNome,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drill, setDrill] = React.useState<DiagnosticoDrillState>({ level: 'areas' });
  const [temaName, setTemaName] = React.useState<string | undefined>(undefined);

  // Atualiza a querystring compondo com os params já presentes (filtros,
  // ?tema= vindo de outra tela etc.) — nunca substitui tudo.
  const updateAreaEspecialidadeParams = React.useCallback(
    (area?: string, especialidade?: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (area) next.set('area', area);
        else next.delete('area');
        if (especialidade) next.set('especialidade', especialidade);
        else next.delete('especialidade');
        return next;
      });
    },
    [setSearchParams],
  );

  // Reconstrói o drill inicial a partir de `?area=`/`?especialidade=` na URL
  // quando os dados chegam/mudam. Se os nomes não existirem na árvore
  // curricular atual (recorte mudou), cai no reset padrão (topo da árvore).
  React.useEffect(() => {
    setTemaName(undefined);

    if (!data) {
      setDrill({ level: 'areas' });
      return;
    }

    const areaParam = searchParams.get('area');
    const especialidadeParam = searchParams.get('especialidade');

    if (areaParam) {
      const area = data.curricular.areas.find((a) => a.name === areaParam);
      if (area) {
        if (especialidadeParam) {
          const especialidade = area.specialties.find((sp) => sp.name === especialidadeParam);
          if (especialidade) {
            setDrill({ level: 'temas', area, especialidade });
            return;
          }
        }
        setDrill({ level: 'especialidades', area });
        return;
      }
    }

    setDrill({ level: 'areas' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const goToAreas = React.useCallback(() => {
    setDrill({ level: 'areas' });
    setTemaName(undefined);
    updateAreaEspecialidadeParams(undefined, undefined);
  }, [updateAreaEspecialidadeParams]);

  const goToEspecialidades = React.useCallback(() => {
    setDrill((prev) => ({ level: 'especialidades', area: prev.area }));
    setTemaName(undefined);
    updateAreaEspecialidadeParams(drill.area?.name, undefined);
  }, [drill.area, updateAreaEspecialidadeParams]);

  if (loading) return <GestorLoading />;
  if (error && !data) return <GestorError message={error} onRetry={onRetry} />;
  if (data?.headerSummary?.triPending) return <GestorTriPending />;

  if (!data) {
    return (
      <GestorEmpty
        title="Selecione um simulado"
        description="Escolha um simulado nos filtros acima para visualizar o diagnóstico curricular."
      />
    );
  }

  const areas = [...data.curricular.areas].sort((a, b) => a.percentual - b.percentual);

  if (areas.length === 0) {
    return (
      <GestorEmpty
        title="Sem dados curriculares no recorte atual"
        description="Ajuste os filtros globais para visualizar grandes áreas, especialidades e temas."
      />
    );
  }

  const handleSelectRow = (row: DrillRowItem) => {
    if (drill.level === 'areas') {
      const area = areas.find((a) => a.name === row.key);
      if (area) {
        setDrill({ level: 'especialidades', area });
        updateAreaEspecialidadeParams(area.name, undefined);
      }
      return;
    }
    if (drill.level === 'especialidades' && drill.area) {
      const especialidade = drill.area.specialties.find((sp) => sp.name === row.key);
      if (especialidade) {
        setDrill({ level: 'temas', area: drill.area, especialidade });
        updateAreaEspecialidadeParams(drill.area.name, especialidade.name);
      }
      return;
    }
    // Nível 'temas' é folha — linhas não são navegáveis (ver `toTemaRow`), então
    // não há transição de drill aqui. Selecionamos o tema para alimentar o
    // card de evolução de acurácia.
  };

  const handleSelectTema = (row: DrillRowItem) => {
    setTemaName(row.key);
  };

  let panelTitle: string;
  let panelSubtitle: string;
  let rows: DrillRowItem[];
  let onSelect: (row: DrillRowItem) => void;

  if (drill.level === 'areas') {
    panelTitle = 'Grandes áreas';
    panelSubtitle = 'acerto médio · nº questões';
    rows = areas.map(toAreaRow);
    onSelect = handleSelectRow;
  } else if (drill.level === 'especialidades' && drill.area) {
    panelTitle = drill.area.name;
    panelSubtitle = 'acerto médio · nº questões';
    rows = [...drill.area.specialties].sort((a, b) => a.percentual - b.percentual).map(toEspecialidadeRow);
    onSelect = handleSelectRow;
  } else if (drill.level === 'temas' && drill.especialidade) {
    panelTitle = drill.especialidade.name;
    panelSubtitle = 'acerto médio · nº questões';
    rows = [...drill.especialidade.temas].sort((a, b) => a.percentual - b.percentual).map(toTemaRow);
    onSelect = handleSelectTema;
  } else {
    // Estado inconsistente (ex.: drill referenciando um nó que sumiu do
    // recorte atual) — volta para o topo da árvore.
    panelTitle = 'Grandes áreas';
    panelSubtitle = 'acerto médio · nº questões';
    rows = areas.map(toAreaRow);
    onSelect = handleSelectRow;
  }

  const recorteAtivo = drill.especialidade?.name ?? drill.area?.name ?? 'todo o exame';

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <SectionHeader
        eyebrow="Diagnóstico curricular"
        title="Do exame ao tema: onde a turma erra"
        corner={usingMock ? <GestorDemoBadge /> : undefined}
      />

      <motion.div variants={itemVariants}>
        <DiagnosticoBreadcrumb
          drill={drill}
          simuladoNome={simuladoNome}
          onGoToAreas={goToAreas}
          onGoToEspecialidades={goToEspecialidades}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <CurricularDrillList
          title={panelTitle}
          subtitle={panelSubtitle}
          rows={rows}
          onSelectRow={onSelect}
        />
        <AccuracyEvolutionCard drill={drill} temaName={temaName} iesId={iesId} />
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-col items-end gap-1">
        <Button
          onClick={() => {
            const target = temaName ? `/gestor/intervencao-impacto?tema=${encodeURIComponent(temaName)}` : '/gestor/intervencao-impacto';
            navigate(target);
          }}
          className="gap-2"
        >
          Simular impacto deste recorte
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="text-xs text-muted-foreground">Recorte atual: {recorteAtivo}</p>
      </motion.div>
    </motion.div>
  );
};
