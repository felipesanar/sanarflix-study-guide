import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { DesempenhoV2Tab } from '@/types/desempenhoV2';
import { TAB_CONFIG } from '@/types/desempenhoV2';

interface Props {
  activeTab: DesempenhoV2Tab;
  onTabChange: (tab: DesempenhoV2Tab) => void;
}

export const PerformanceModuleTabs: React.FC<Props> = ({ activeTab, onTabChange }) => (
  <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none" role="tablist">
    {TAB_CONFIG.map((tab) => {
      const isActive = tab.value === activeTab;
      return (
        <button
          key={tab.value}
          role="tab"
          aria-selected={isActive}
          aria-label={`Módulo ${tab.label}`}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            'relative whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-lg transition-colors shrink-0',
            isActive
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/80 hover:bg-accent/40'
          )}
        >
          {isActive && (
            <motion.div
              layoutId="active-tab-pill"
              className="absolute inset-0 bg-background border border-border/80 rounded-lg shadow-sm"
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      );
    })}
  </nav>
);
