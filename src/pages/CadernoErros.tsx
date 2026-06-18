import React from 'react';
import { Wrench } from 'lucide-react';
import { motion } from 'framer-motion';

export const CadernoErros: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-lg w-full text-center space-y-6 p-8 rounded-3xl border border-border/40 bg-card/50 backdrop-blur-sm"
      >
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Wrench className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Caderno de Erros em manutenção
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Estamos implementando melhorias e correções nesta seção para entregar
            uma experiência ainda melhor. Em breve, o Caderno de Erros estará
            disponível novamente.
          </p>
        </div>
        <p className="text-xs text-muted-foreground/70">
          Seus registros estão preservados e seguros.
        </p>
      </motion.div>
    </div>
  );
};

export default CadernoErros;
