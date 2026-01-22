import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { 
  BookOpen, Zap, BarChart3, Calendar, ArrowRight, RefreshCw, AlertCircle, 
  CalendarCheck, FileText, GraduationCap, Trophy, Home as HomeIcon, 
  ClipboardCheck, TrendingUp, UserCog, Clock, Sparkles
} from 'lucide-react';
import { MeuDiaItem } from '@/hooks/useHomeData';
import { Skeleton } from '@/components/ui/skeleton';

interface MeuDiaCardProps {
  items: MeuDiaItem[];
  hasStudyGuide: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const iconMap: Record<string, any> = { BookOpen, Zap, BarChart3 };
const routeIconMap: Record<string, any> = {
  '/home': HomeIcon,
  '/guia-estudos': BookOpen,
  '/dashboard': BarChart3,
  '/sanarclass': GraduationCap,
  '/simulados': ClipboardCheck,
  '/intensivao-enamed': Zap,
  '/intensivo-uscs': BookOpen,
  '/cronograma-enamed': FileText,
  '/analytics': TrendingUp,
  '/gestao-usuarios': UserCog,
};

const resolveIcon = (path?: string, icon?: string) => {
  if (path) {
    for (const key of Object.keys(routeIconMap)) {
      if (path === key || path.startsWith(key)) return routeIconMap[key];
    }
  }
  if (icon && iconMap[icon]) return iconMap[icon];
  return BookOpen;
};

// Empty state component
const EmptyState = ({ hasStudyGuide }: { hasStudyGuide: boolean }) => {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="mb-6 relative">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
          <Calendar className="w-10 h-10 text-muted-foreground/30" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      </div>

      <h3 className="text-base font-semibold text-foreground mb-2">
        Nenhuma atividade para hoje
      </h3>
      
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
        {hasStudyGuide 
          ? "Você não tem matérias agendadas para hoje."
          : "Configure seu plano de estudos para começar."
        }
      </p>

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={() => navigate(hasStudyGuide ? '/cronograma-enamed' : '/guia-estudos')}
          variant="outline"
          className="gap-2 rounded-xl"
        >
          {hasStudyGuide ? (
            <>
              <Calendar className="w-4 h-4" />
              Configurar Calendário
            </>
          ) : (
            <>
              <BookOpen className="w-4 h-4" />
              Configurar Guia de Estudos
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
};

// Loading skeleton
const LoadingSkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/20">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="w-20 h-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
};

// Error state
const ErrorState = ({ onRetry }: { onRetry?: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      
      <h3 className="text-base font-semibold text-foreground mb-2">
        Erro ao carregar dados
      </h3>
      
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
        Não foi possível carregar suas atividades.
      </p>

      {onRetry && (
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={onRetry} variant="outline" className="gap-2 rounded-xl">
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export const MeuDiaCard: React.FC<MeuDiaCardProps> = ({ 
  items, 
  hasStudyGuide,
  loading = false,
  error = null,
  onRetry
}) => {
  const navigate = useNavigate();

  const handleItemClick = (item: MeuDiaItem) => {
    if (item.icon === 'Trophy' || /simulado/i.test(item.title) || (item.path && item.path.includes('simulado'))) {
      navigate('/simulados');
      return;
    }
    
    if (item.source === 'cronograma_enamed') {
      navigate('/home');
      return;
    }
    
    if (item.aulaNome && item.path.includes('guia-estudos')) {
      navigate(item.path);
      return;
    }
    
    navigate(item.path);
  };

  const handleLessonClick = (e: React.MouseEvent, link: string) => {
    e.stopPropagation();
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const isSimulado = (item: MeuDiaItem) => 
    item.icon === 'Trophy' || /simulado/i.test(item.title);

  return (
    <div className="relative overflow-hidden rounded-2xl card-premium h-full">
      {/* Decorative gradient */}
      <div className="absolute -top-16 -left-16 w-32 h-32 rounded-full bg-primary/5 dark:bg-primary/10 blur-3xl" />
      
      {/* Header */}
      <div className="relative px-5 pt-5 pb-3 md:px-6 md:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Calendar className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Meu Dia</h3>
              <p className="text-xs text-muted-foreground">Atividades sugeridas</p>
            </div>
          </div>
          {!loading && !error && items.length > 0 && (
            <Badge className="rounded-full px-3 py-1 text-[11px] font-semibold bg-primary/10 text-primary border-0">
              {items.length} {items.length === 1 ? 'Sugestão' : 'Sugestões'}
            </Badge>
          )}
        </div>
      </div>
      
      <div className="relative px-5 pb-5 md:px-6 md:pb-6">
        {loading && <LoadingSkeleton />}
        
        {!loading && error && <ErrorState onRetry={onRetry} />}
        
        {!loading && !error && items.length === 0 && (
          <EmptyState hasStudyGuide={hasStudyGuide} />
        )}
        
        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item, index) => {
              const Icon = resolveIcon(item.path, item.icon);
              const simulado = isSimulado(item);
              
              return (
                <motion.div
                  key={`${item.id}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  onClick={() => handleItemClick(item)}
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  className="group cursor-pointer"
                >
                  <div className={`
                    relative p-4 rounded-xl transition-all duration-200
                    ${simulado 
                      ? 'glass bg-gradient-to-r from-primary/8 to-primary/4 border-primary/20 hover:border-primary/40' 
                      : 'glass hover:bg-muted/30'
                    }
                  `}>
                    {/* Simulado glow */}
                    {simulado && (
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                    
                    <div className="relative flex items-center gap-4">
                      {/* Icon */}
                      <div className={`
                        flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200
                        ${simulado 
                          ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20' 
                          : 'bg-muted/50 text-muted-foreground group-hover:bg-muted'
                        }
                      `}>
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className={`font-semibold text-sm truncate ${simulado ? 'text-primary' : 'text-foreground'}`}>
                            {item.aulaNome || item.title}
                          </h4>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          {item.source === 'cronograma_enamed' && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-2 py-0 h-5 font-medium bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                            >
                              CRONOGRAMA ENAMED
                            </Badge>
                          )}
                          {item.source === 'calendar' && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-2 py-0 h-5 font-medium bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            >
                              <CalendarCheck className="w-2.5 h-2.5 mr-1" />
                              MEU CALENDÁRIO
                            </Badge>
                          )}
                          <span className="flex items-center gap-1 text-muted-foreground/70">
                            <Clock className="w-3 h-3" />
                            45 min
                          </span>
                        </div>
                      </div>
                      
                      {/* Action */}
                      {item.lessonLink ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-shrink-0 gap-1.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
                          onClick={(e) => handleLessonClick(e, item.lessonLink!)}
                        >
                          Assistir
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
