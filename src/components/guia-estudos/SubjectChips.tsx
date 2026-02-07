import React, { useRef, useState, useEffect } from 'react';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SubjectChip {
  name: string;
  icon: string;
  color?: string;
}

interface SubjectChipsProps {
  subjects: SubjectChip[];
  selectedSubject: string;
  onSelectSubject: (name: string) => void;
  className?: string;
}

export const SubjectChips: React.FC<SubjectChipsProps> = ({
  subjects,
  selectedSubject,
  onSelectSubject,
  className
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftFade(scrollLeft > 10);
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [subjects]);

  const scrollTo = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={cn("relative", className)}
    >
      {/* Left fade + scroll button */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 z-10 flex items-center",
        "bg-gradient-to-r from-background via-background/80 to-transparent",
        "transition-opacity duration-200",
        showLeftFade ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full bg-card shadow-md border border-border/50"
          onClick={() => scrollTo('left')}
          aria-label="Rolar chips para a esquerda"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable container */}
      <div 
        ref={scrollRef}
        className={cn(
          "flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-1",
          "scroll-smooth snap-x snap-mandatory",
          "-mx-1"
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* "All subjects" chip */}
        <button
          onClick={() => onSelectSubject('')}
          className={cn(
            "shrink-0 snap-start flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl",
            "text-sm font-medium transition-all duration-200",
            "border shadow-sm",
            selectedSubject === ''
              ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
              : "bg-card hover:bg-muted border-border/50 text-foreground hover:border-primary/30"
          )}
          aria-pressed={selectedSubject === ''}
        >
          <BookOpen className="h-4 w-4" />
          <span className="whitespace-nowrap">Todas as Matérias</span>
        </button>

        {/* Subject chips */}
        {subjects.map((subject, idx) => {
          const isSelected = selectedSubject === subject.name;
          
          // Estilo do fundo colorido sutil (quando não selecionado e tem cor)
          const subtleColorStyle = !isSelected && subject.color ? {
            backgroundColor: `color-mix(in srgb, ${subject.color} 8%, transparent)`,
            borderColor: `color-mix(in srgb, ${subject.color} 20%, hsl(var(--border)))`,
          } : {};

          return (
            <motion.button
              key={subject.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectSubject(subject.name)}
              className={cn(
                "shrink-0 snap-start flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl",
                "text-sm font-medium transition-all duration-200",
                "border shadow-sm",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "hover:brightness-105 border-border/50 text-foreground",
                // Glassmorphism sutil quando tem cor e não está selecionado
                !isSelected && subject.color && "backdrop-blur-sm",
                // Fallback para bg-card quando não tem cor
                !isSelected && !subject.color && "bg-card hover:bg-muted hover:border-primary/30"
              )}
              style={subtleColorStyle}
              aria-pressed={isSelected}
            >
              <span className="text-base" style={{ 
                filter: isSelected ? 'brightness(1.2)' : 'none' 
              }}>
                {subject.icon}
              </span>
              <span className="whitespace-nowrap">{subject.name}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Right fade + scroll button */}
      <div className={cn(
        "absolute right-0 top-0 bottom-0 z-10 flex items-center",
        "bg-gradient-to-l from-background via-background/80 to-transparent",
        "transition-opacity duration-200",
        showRightFade ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full bg-card shadow-md border border-border/50"
          onClick={() => scrollTo('right')}
          aria-label="Rolar chips para a direita"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
};
