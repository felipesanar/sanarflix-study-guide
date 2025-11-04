import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

export const PageLoader = ({ message = 'Carregando...' }: PageLoaderProps) => {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] w-full bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-6 p-8"
      >
        {/* Logo animado */}
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-gradient-primary" />
          </div>
        </div>

        {/* Texto */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{message}</h3>
          <p className="text-sm text-muted-foreground">Preparando seu conteúdo...</p>
        </div>

        {/* Barra de progresso animada */}
        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-primary"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>
      </motion.div>
    </div>
  );
};
