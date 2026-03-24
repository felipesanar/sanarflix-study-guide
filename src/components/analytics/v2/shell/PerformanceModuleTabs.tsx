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
    className="w-full"
  >
    <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto rounded-lg border bg-muted/60 p-1.5 shadow-inner">
      {TAB_CONFIG.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className="whitespace-nowrap text-xs sm:text-sm px-3.5 py-2 shrink-0 min-h-9 rounded-md border border-transparent data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm hover:text-foreground/90"
          aria-label={`Abrir módulo ${tab.label}`}
        >
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);
