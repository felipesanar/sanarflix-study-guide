import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ZoomIn, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Componente de lightbox para ampliar imagens no Modo Prova.
 * Exibe thumbnail clicável com indicador de zoom no hover.
 * Ao clicar, abre dialog fullscreen com imagem ampliada e zoom interativo.
 */
export const ImageLightbox = ({ src, alt, className }: ImageLightboxProps) => {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;
  const SCALE_STEP = 0.5;

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + SCALE_STEP, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const newScale = Math.max(prev - SCALE_STEP, MIN_SCALE);
      if (newScale === MIN_SCALE) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }, [handleZoomIn, handleZoomOut]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      positionStart.current = { ...position };
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: positionStart.current.x + dx,
        y: positionStart.current.y + dy,
      });
    }
  }, [isDragging, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Clicar na imagem aplica zoom ou reseta
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Se estiver arrastando, não faz nada
    if (isDragging) return;
    
    // Se não moveu significativamente (clique simples)
    const movedX = Math.abs(e.clientX - dragStart.current.x);
    const movedY = Math.abs(e.clientY - dragStart.current.y);
    
    if (movedX < 5 && movedY < 5) {
      if (scale === 1) {
        setScale(2);
      } else if (scale < MAX_SCALE) {
        setScale((prev) => Math.min(prev + 1, MAX_SCALE));
      } else {
        handleReset();
      }
    }
  }, [scale, isDragging, handleReset]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, []);

  return (
    <>
      {/* Thumbnail clicável */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative group cursor-zoom-in block"
        aria-label="Ampliar imagem"
      >
        <img src={src} alt={alt} className={cn(className, 'block')} />
        {/* Overlay com ícone de zoom */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
          <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 drop-shadow-lg" />
        </div>
      </button>

      {/* Dialog fullscreen */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 border-0 bg-black/95 flex items-center justify-center overflow-hidden group/lightbox"
          aria-describedby={undefined}
        >
          {/* Botão de fechar - visível apenas no hover */}
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-all opacity-0 group-hover/lightbox:opacity-100"
            aria-label="Fechar"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          
          {/* Container da imagem com zoom e pan */}
          <div
            className={cn(
              "max-w-[90vw] max-h-[90vh] overflow-hidden",
              scale > 1 ? "cursor-grab" : "cursor-zoom-in",
              isDragging && "cursor-grabbing"
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={(e) => {
              handleClick(e);
              handleMouseUp();
            }}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <img
              src={src}
              alt={alt}
              className="max-w-[90vw] max-h-[90vh] object-contain select-none transition-transform duration-100"
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              }}
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
