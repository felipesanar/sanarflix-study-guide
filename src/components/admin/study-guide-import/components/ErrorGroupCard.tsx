/**
 * ErrorGroupCard Component
 * Expandable card for grouped validation errors with actions
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Download, ArrowLeft, Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  getErrorMetadata,
  getSeverityStyles,
  extractUniqueValues,
  formatRowNumbers,
  type ErrorActionType,
} from '../utils/errorMetadata';
import { generateErrorReport, downloadAsFile } from '../utils/parseFile';
import type { ValidationIssue } from '../types';

interface ErrorGroupCardProps {
  code: string;
  issues: ValidationIssue[];
  onNavigateBack?: () => void;
  defaultExpanded?: boolean;
}

export const ErrorGroupCard: React.FC<ErrorGroupCardProps> = ({
  code,
  issues,
  onNavigateBack,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const metadata = getErrorMetadata(code);
  const styles = getSeverityStyles(metadata.severity);
  const IconComponent = metadata.icon;

  // Extract unique invalid values from messages
  const uniqueValues = React.useMemo(
    () => extractUniqueValues(issues.map(i => i.message)),
    [issues]
  );

  // Format row numbers for display
  const rowNumbers = React.useMemo(
    () => issues.map(i => i.rowNumber).sort((a, b) => a - b),
    [issues]
  );
  const formattedRows = formatRowNumbers(rowNumbers, 8);

  // Handle action clicks
  const handleAction = (actionType: ErrorActionType) => {
    switch (actionType) {
      case 'download':
        handleDownload();
        break;
      case 'navigate':
        onNavigateBack?.();
        break;
      case 'info':
        setIsExpanded(true);
        break;
    }
  };

  // Generate and download CSV report for this error type
  const handleDownload = () => {
    const csvContent = generateErrorReport(issues);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    downloadAsFile(csvContent, `erros-${code.toLowerCase()}-${timestamp}.csv`);
  };

  return (
    <div
      className={cn(
        'rounded-xl border-2 overflow-hidden transition-all duration-200',
        styles.border,
        isExpanded ? styles.bg : 'bg-card hover:bg-muted/30'
      )}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 text-left"
      >
        {/* Icon */}
        <div className={cn('mt-0.5 shrink-0', styles.text)}>
          <IconComponent className="h-5 w-5" />
        </div>

        {/* Title and Description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={cn('font-semibold', styles.text)}>
              {metadata.title}
            </h4>
            <Badge variant="outline" className={cn('text-xs', styles.badge)}>
              {issues.length.toLocaleString('pt-BR')} {issues.length === 1 ? 'linha' : 'linhas'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {metadata.description}
          </p>
        </div>

        {/* Expand indicator */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="px-4 pb-4 pt-0 space-y-4">
              {/* Detailed Description */}
              <div className="rounded-lg bg-muted/50 p-3">
                <h5 className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  O que está errado?
                </h5>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {metadata.detailedDescription}
                </p>
              </div>

              {/* Invalid Values Found */}
              {uniqueValues.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium mb-2">
                    Valores inválidos encontrados:
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueValues.map((value, i) => (
                      <code
                        key={i}
                        className="px-2 py-0.5 rounded bg-muted text-xs font-mono text-foreground"
                      >
                        {value}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Affected Rows */}
              <div>
                <h5 className="text-sm font-medium mb-2">Linhas afetadas:</h5>
                <ScrollArea className="max-h-24">
                  <div className="flex flex-wrap gap-1.5">
                    {formattedRows.visible.map((row, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
                      >
                        {row}
                      </span>
                    ))}
                    {formattedRows.remaining > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-muted/60 text-xs text-muted-foreground">
                        +{formattedRows.remaining.toLocaleString('pt-BR')} mais
                      </span>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Tip */}
              {metadata.tip && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <h5 className="text-sm font-medium mb-1 text-amber-600 dark:text-amber-400">
                    💡 Dica
                  </h5>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {metadata.tip}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {metadata.actions.map((action, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(action.type)}
                    className="gap-1.5"
                  >
                    {action.type === 'download' && <Download className="h-3.5 w-3.5" />}
                    {action.type === 'navigate' && <ArrowLeft className="h-3.5 w-3.5" />}
                    {action.type === 'info' && <ExternalLink className="h-3.5 w-3.5" />}
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
