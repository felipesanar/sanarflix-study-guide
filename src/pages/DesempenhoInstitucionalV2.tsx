import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionHeader } from '@/components/analytics/SectionHeader';
import { School } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <SectionHeader
          titulo="Desempenho Institucional v2"
          subtitulo="Visão geral do desempenho dos alunos nos simulados — B2B"
          icon={<School className="h-5 w-5 text-primary" />}
          className="mb-0"
        />
        <div className="flex gap-2 shrink-0">
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

      {/* 2. KPI Cards */}
      <KpiCardsGrid kpis={mockKpis} />

      {/* 3 & 4. Distribution + Meta side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FaixaDistribuicaoChart faixas={mockFaixas} />
        <MetaInstitucionalCard meta={mockMeta} />
      </div>

      {/* 5. Evolution Chart */}
      <EvolucaoChart evolucao={mockEvolucao} />

      {/* 6. Distance Cards */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Distância para Próxima Faixa</h3>
        <DistanciaFaixaCards items={mockDistanciaFaixa} />
      </div>
    </motion.div>
  );
};

export default DesempenhoInstitucionalV2;
