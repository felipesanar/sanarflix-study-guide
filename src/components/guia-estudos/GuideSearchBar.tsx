import React, { useState, useRef, useEffect } from 'react';
import { Search, Clock, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchSuggestion {
  text: string;
  type: 'recent' | 'materia' | 'tema' | 'aula';
}

interface GuideSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: SearchSuggestion[];
  lastSearch?: string;
  placeholder?: string;
  className?: string;
  onSuggestionClick?: (text: string) => void;
}

export const GuideSearchBar: React.FC<GuideSearchBarProps> = ({
  value,
  onChange,
  suggestions = [],
  lastSearch,
  placeholder = "O que você quer aprender hoje?",
  className,
  onSuggestionClick
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Build flat list of options for keyboard nav: lastSearch (when !value) or suggestions
  const options = (() => {
    if (lastSearch && !value) return [{ text: lastSearch, type: 'recent' as const }];
    return suggestions.slice(0, 6).map((s) => ({ text: s.text, type: s.type }));
  })();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show dropdown when focused and has suggestions; reset highlight
  useEffect(() => {
    if (isFocused && (suggestions.length > 0 || lastSearch)) {
      setShowDropdown(true);
      setHighlightedIndex(0);
    }
  }, [isFocused, suggestions, lastSearch]);

  // Keep highlighted index in range and scroll into view
  useEffect(() => {
    const len = options.length;
    if (len === 0) return;
    const idx = Math.max(0, Math.min(highlightedIndex, len - 1));
    if (idx !== highlightedIndex) setHighlightedIndex(idx);
    optionRefs.current[idx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedIndex, options.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
      return;
    }
    if (!showDropdown || options.length === 0) {
      if (e.key === 'Enter' && value.trim()) setShowDropdown(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % options.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + options.length) % options.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = options[highlightedIndex];
      if (selected) {
        handleSuggestionClick(selected.text);
      }
    }
  };

  const handleSuggestionClick = (text: string) => {
    onChange(text);
    onSuggestionClick?.(text);
    setShowDropdown(false);
  };

  const clearSearch = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const getTypeLabel = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'materia': return 'Matéria';
      case 'tema': return 'Tema';
      case 'aula': return 'Aula';
      default: return null;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input Container */}
      <div className={cn(
        "relative rounded-xl transition-all duration-300",
        isFocused 
          ? "ring-2 ring-primary/40 shadow-lg shadow-primary/10" 
          : "shadow-sm hover:shadow-md"
      )}>
        <div className={cn(
          "absolute inset-0 rounded-xl transition-opacity duration-300",
          isFocused ? "opacity-100" : "opacity-0",
          "bg-gradient-to-r from-primary/5 via-transparent to-primary/5"
        )} />
        
        <Search className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 z-10 transition-colors duration-200",
          isFocused ? "text-primary" : "text-muted-foreground"
        )} />
        
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "h-12 pl-11 pr-10 rounded-xl border-border/50 bg-card/80 backdrop-blur-sm",
            "text-sm placeholder:text-muted-foreground/70",
            "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary/30",
            "transition-all duration-200"
          )}
          aria-label="Buscar por matéria, tema ou aula"
        />
        
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-muted/80"
            onClick={clearSearch}
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (suggestions.length > 0 || lastSearch) && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute top-full left-0 right-0 mt-2 z-50",
              "bg-card/95 backdrop-blur-xl rounded-xl border border-border/50",
              "shadow-xl shadow-black/10 dark:shadow-black/30",
              "overflow-hidden"
            )}
          >
            {/* Recent search */}
            {lastSearch && !value && (
              <div className="px-3 py-2 border-b border-border/30">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Pesquisa recente
                </span>
              </div>
            )}

            <ul ref={listboxRef} className="py-1 max-h-64 overflow-y-auto" role="listbox" aria-label="Sugestões de busca">
              {options.map((option, idx) => (
                <li key={`${option.text}-${idx}`} role="option" aria-selected={idx === highlightedIndex}>
                  <button
                    ref={(el) => { optionRefs.current[idx] = el; }}
                    type="button"
                    className={cn(
                      "w-full text-left px-4 py-2.5 transition-colors flex items-center gap-3 group",
                      idx === highlightedIndex ? "bg-primary/10 text-foreground" : "hover:bg-primary/5"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionClick(option.text)}
                  >
                    {option.type === 'recent' ? (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Search className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 text-sm truncate">
                      {value && option.text.toLowerCase().includes(value.toLowerCase()) ? (
                        <>
                          {option.text.substring(0, option.text.toLowerCase().indexOf(value.toLowerCase()))}
                          <span className="font-semibold text-primary">
                            {option.text.substring(
                              option.text.toLowerCase().indexOf(value.toLowerCase()),
                              option.text.toLowerCase().indexOf(value.toLowerCase()) + value.length
                            )}
                          </span>
                          {option.text.substring(
                            option.text.toLowerCase().indexOf(value.toLowerCase()) + value.length
                          )}
                        </>
                      ) : (
                        option.text
                      )}
                    </span>
                    {getTypeLabel(option.type) && (
                      <span className="text-[10px] font-medium text-muted-foreground/70 uppercase">
                        {getTypeLabel(option.type)}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Empty state */}
            {value && suggestions.length === 0 && (
              <div className="px-4 py-6 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum resultado encontrado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Tente uma busca diferente</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
