import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickActionsDockProps {
  hasStudyGuide: boolean;
  hasCronograma: boolean;
}

export const QuickActionsDock: React.FC<QuickActionsDockProps> = ({ hasStudyGuide, hasCronograma }) => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Continuar',
      icon: BookOpen,
      onClick: () => navigate(hasStudyGuide ? '/guia-estudos' : '/guia-estudos'),
      color: 'from-blue-500/30 to-blue-500/10',
    },
    {
      label: 'Cronograma',
      icon: Calendar,
      onClick: () => navigate(hasCronograma ? '/cronograma-enamed' : '/guia-estudos'),
      color: 'from-emerald-500/30 to-emerald-500/10',
    },
    {
      label: 'Desempenho',
      icon: Trophy,
      onClick: () => navigate('/desempenho-simulado'),
      color: 'from-amber-500/30 to-amber-500/10',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-6 right-6 z-40"
    >
      <div className="px-3 py-2 rounded-2xl bg-background/70 backdrop-blur-xl border border-border/50 shadow-lg">
        <div className="flex items-center gap-2">
          {actions.map(({ label, icon: Icon, onClick, color }) => (
            <motion.button
              key={label}
              onClick={onClick}
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="group relative inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/40 transition-all"
              title={label}
            >
              <span className={`absolute inset-0 -z-10 rounded-xl bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 blur-lg transition-opacity`} />
              <Icon className="h-5 w-5 text-foreground" />
              <span className="text-sm font-medium text-foreground/80">{label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};