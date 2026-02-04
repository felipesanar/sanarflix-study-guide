import React from 'react';
import { BookOpen, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GuideHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export const GuideHeader: React.FC<GuideHeaderProps> = ({
  title = "Guia de Estudos",
  subtitle = "ACADEMY",
  className
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("flex items-center gap-3", className)}
    >
      <div className="relative">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shadow-sm">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 p-1 rounded-full bg-background border border-border shadow-sm">
          <GraduationCap className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      </div>
      <div className="flex flex-col">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <span className="text-[10px] sm:text-xs font-semibold text-primary/80 uppercase tracking-widest">
          {subtitle}
        </span>
      </div>
    </motion.div>
  );
};
