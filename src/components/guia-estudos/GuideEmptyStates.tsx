import React from 'react';
import { BookOpen, Search, Calendar, AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  className?: string;
}

interface ActionableEmptyStateProps extends EmptyStateProps {
  onAction?: () => void;
  actionLabel?: string;
}

// No content for semester
export const NoContentForSemester: React.FC<ActionableEmptyStateProps> = ({
  onAction,
  actionLabel = "Selecionar outro semestre",
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn("p-8 sm:p-12", className)}>
        <CardContent className="p-0">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5">
                <Inbox className="h-12 w-12 text-muted-foreground" />
              </div>
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2 p-2 rounded-full bg-primary/10"
              >
                <BookOpen className="h-4 w-4 text-primary" />
              </motion.div>
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-semibold text-foreground">
                Nenhum conteúdo disponível
              </h3>
              <p className="text-sm text-muted-foreground">
                Não há conteúdos disponíveis para este semestre ainda. 
                Tente selecionar outro semestre ou aguarde a liberação de novos materiais.
              </p>
            </div>
            {onAction && (
              <Button variant="outline" onClick={onAction} className="mt-2 rounded-lg">
                {actionLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// No search results
export const NoSearchResults: React.FC<ActionableEmptyStateProps> = ({
  onAction,
  actionLabel = "Limpar busca",
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn("p-8 sm:p-12", className)}>
        <CardContent className="p-0">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5">
              <Search className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-semibold text-foreground">
                Nenhum resultado encontrado
              </h3>
              <p className="text-sm text-muted-foreground">
                Não encontramos conteúdos que correspondam à sua busca. 
                Tente usar termos diferentes ou limpe os filtros.
              </p>
            </div>
            {onAction && (
              <Button variant="outline" onClick={onAction} className="mt-2 rounded-lg">
                {actionLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// No subjects filtered
export const NoFilteredSubjects: React.FC<ActionableEmptyStateProps> = ({
  onAction,
  actionLabel = "Ver todas as matérias",
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn("p-8 sm:p-12", className)}>
        <CardContent className="p-0">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-semibold text-foreground">
                Nenhuma matéria encontrada
              </h3>
              <p className="text-sm text-muted-foreground">
                Não há matérias correspondentes aos filtros selecionados.
              </p>
            </div>
            {onAction && (
              <Button variant="outline" onClick={onAction} className="mt-2 rounded-lg">
                {actionLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Error state
export const ErrorState: React.FC<ActionableEmptyStateProps & { errorMessage?: string }> = ({
  onAction,
  actionLabel = "Tentar novamente",
  errorMessage = "Não foi possível carregar os conteúdos. Verifique sua conexão e tente novamente.",
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn("p-8 sm:p-12 border-destructive/30", className)}>
        <CardContent className="p-0">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-5 rounded-2xl bg-destructive/10">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-semibold text-foreground">
                Erro ao carregar conteúdos
              </h3>
              <p className="text-sm text-muted-foreground">
                {errorMessage}
              </p>
            </div>
            {onAction && (
              <Button 
                variant="outline" 
                onClick={onAction} 
                className="mt-2 gap-2 rounded-lg border-destructive/30 hover:bg-destructive/10"
              >
                <RefreshCw className="h-4 w-4" />
                {actionLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// No IES access
export const NoIesAccess: React.FC<EmptyStateProps> = ({ className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-center min-h-[60vh]"
    >
      <Card className={cn("max-w-md", className)}>
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">
                Acesso Restrito
              </h3>
              <p className="text-sm text-muted-foreground">
                Você precisa estar vinculado a uma instituição para acessar o guia de estudos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Export all
export const GuideEmptyStates = {
  NoContent: NoContentForSemester,
  NoSearch: NoSearchResults,
  NoFiltered: NoFilteredSubjects,
  Error: ErrorState,
  NoAccess: NoIesAccess,
};
