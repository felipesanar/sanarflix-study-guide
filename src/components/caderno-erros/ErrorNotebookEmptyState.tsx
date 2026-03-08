import React from 'react';
import { BookMarked, Search, PlusCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ErrorNotebookEmptyStateProps {
  type: 'no-entries' | 'no-results';
}

export const ErrorNotebookEmptyState: React.FC<ErrorNotebookEmptyStateProps> = ({ type }) => {
  if (type === 'no-results') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center justify-center py-20 px-4 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-5 border border-border/30">
          <Search className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1.5">Nenhum resultado encontrado</h3>
        <p className="text-sm text-muted-foreground/70 max-w-sm leading-relaxed">
          Tente ajustar seus filtros ou busca para encontrar seus registros.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center py-20 px-4 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-5 border border-primary/10">
        <BookMarked className="h-7 w-7 text-primary/60" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">Seu caderno de erros está vazio</h3>
      <p className="text-sm text-muted-foreground/70 max-w-sm leading-relaxed">
        Ao revisar suas questões nos simulados, adicione erros ao caderno para acompanhar seus gaps e evitar repeti-los.
      </p>
    </motion.div>
  );
};
