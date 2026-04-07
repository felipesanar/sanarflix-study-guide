import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TooltipInfoProps {
  text: string;
  position?: 'top' | 'right' | 'left' | 'bottom';
  section?: string;
}

export const TooltipInfo: React.FC<TooltipInfoProps> = ({
  text,
  position = 'top',
  section,
}) => {
  if (section) {
    console.log('[TooltipInfo] render', { section });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground/70 transition-opacity duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
            aria-label="Mais informações"
          >
            <HelpCircle className="h-[14px] w-[14px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={position}
          className="max-w-[250px] text-xs leading-relaxed whitespace-pre-line"
          sideOffset={6}
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
