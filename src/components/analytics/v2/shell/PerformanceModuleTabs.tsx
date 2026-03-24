import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DesempenhoV2Tab } from '@/types/desempenhoV2';
import { TAB_CONFIG } from '@/types/desempenhoV2';

interface Props {
  activeTab: DesempenhoV2Tab;
  onTabChange: (tab: DesempenhoV2Tab) => void;
}

export const PerformanceModuleTabs: React.FC<Props> = ({ activeTab, onTabChange }) => (
  <Tabs
    value={activeTab}
    onValueChange={(value) => {
      if (TAB_CONFIG.some((tab) => tab.value === value)) {
        onTabChange(value as DesempenhoV2Tab);
      }
    }}
  >
    <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 bg-muted">
      {TAB_CONFIG.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className="whitespace-nowrap text-xs sm:text-sm px-3 py-1.5 shrink-0"
          aria-label={`Abrir módulo ${tab.label}`}
        >
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);
