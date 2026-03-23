import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

import { KpiCardsGrid } from '@/components/analytics/v2/KpiCardsGrid';
import { FaixaDistribuicaoChart } from '@/components/analytics/v2/FaixaDistribuicaoChart';
import { MetaInstitucionalCard } from '@/components/analytics/v2/MetaInstitucionalCard';
import { EvolucaoChart } from '@/components/analytics/v2/EvolucaoChart';
import { DistanciaFaixaCards } from '@/components/analytics/v2/DistanciaFaixaCards';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';

import {
  mockKpis,
  mockFaixas,
  mockMeta,
  mockEvolucao,
  mockDistanciaFaixa,
  mockAlunosAbaixo,
} from '@/mocks/desempenhoInstitucionalV2';

const DesempenhoInstitucionalV2: React.FC = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[DesempenhoV2]', 'Page mounted');
    const timer = setTimeout(() => {
      setLoading(false);
      console.log('[DesempenhoV2]', 'Mock data loaded');
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <DesempenhoV2Skeleton />;

  return (
    <motion.div
      className="space-y-6 pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* 1. Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-block text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
              Situação atual da instituição
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Dashboard ENAMED
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">35% dos alunos são proficientes.</span>{' '}
                Faltam 55 alunos proficientes para atingir Conceito 5 (90%).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 shrink-0">
            <div className="flex gap-2">
              <Select defaultValue="b2b">
                <SelectTrigger className="w-[120px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2b">B2B</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="simulado-teste">
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simulado-teste">Simulado Teste</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Risk alert card */}
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 w-fit">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Sanção regulatória ativa</p>
            <p className="text-xs text-muted-foreground">
              Com 35% de alunos proficientes, há redução de 50% das vagas. Faltam 5 alunos proficientes para sair desta sanção.
            </p>
          </div>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <KpiCardsGrid kpis={mockKpis} alunosAbaixo={mockAlunosAbaixo} />

      {/* 3. Meta + Distance side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetaInstitucionalCard meta={mockMeta} />
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Distância para Próxima Faixa</h3>
          <DistanciaFaixaCards items={mockDistanciaFaixa} />
        </div>
      </div>

      {/* 4 & 5. Charts at the bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FaixaDistribuicaoChart faixas={mockFaixas} />
        <EvolucaoChart evolucao={mockEvolucao} />
      </div>
    </motion.div>
  );
};

export default DesempenhoInstitucionalV2;
