import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProgressHub } from '@/hooks/useProgressHub';
import { useAuth } from '@/contexts/AuthContext';
import {
  ProgressHeroCard,
  NextActionsCard,
  ConsistencyCard,
  SemesterMapCard,
  WeeklyEvolutionCard,
  ProgressHubSkeleton
} from '@/components/progress-hub';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { 
    data, 
    loading, 
    error, 
    syncing, 
    refresh, 
    completeTheme 
  } = useProgressHub();

  // Show skeleton while loading
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <ProgressHubSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={refresh} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Central de Progresso</h1>
              <p className="text-sm text-muted-foreground">
                {user?.ies_nome} • {user?.semestre}º período
              </p>
            </div>
          </div>
          {syncing && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </motion.div>

        {/* Hero Card */}
        <motion.div variants={itemVariants}>
          <ProgressHeroCard
            overview={data.overview}
            streak={data.streak}
            lastActivity={data.last_activity}
            user={data.user}
          />
        </motion.div>

        {/* Grid: Next Actions + Consistency + Evolution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={itemVariants}>
            <NextActionsCard actions={data.next_actions} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <ConsistencyCard streak={data.streak} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <WeeklyEvolutionCard evolution={data.weekly_evolution} />
          </motion.div>
        </div>

        {/* Semester Map */}
        <motion.div variants={itemVariants}>
          <SemesterMapCard
            byMateria={data.by_materia}
            byTema={data.by_tema}
            onCompleteTheme={completeTheme}
            syncing={syncing}
          />
        </motion.div>
      </motion.div>
    </div>
  );
};
