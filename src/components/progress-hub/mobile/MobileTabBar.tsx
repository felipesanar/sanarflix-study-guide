import React from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, Lightbulb, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MobileTab } from './ProgressHubMobile';

interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

const TABS: { id: MobileTab; label: string; icon: React.ElementType }[] = [
  { id: 'agora', label: 'Agora', icon: Zap },
  { id: 'progresso', label: 'Progresso', icon: TrendingUp },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'provas', label: 'Provas', icon: GraduationCap },
];

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div 
      className="flex items-center px-4 py-2 gap-1"
      role="tablist"
      aria-label="Navegação de seções"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg',
              'text-xs font-medium transition-colors min-h-[44px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              isActive 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{tab.label}</span>
            
            {/* Active indicator */}
            {isActive && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
