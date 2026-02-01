import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ImageLightboxProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Componente de lightbox para ampliar imagens no Modo Prova.
 * Exibe thumbnail clicável com indicador de zoom no hover.
 * Ao clicar, abre dialog fullscreen com imagem ampliada e controles de zoom.
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

  const handleDoubleClick = useCallback(() => {
    if (scale === 1) {
      setScale(2);
    } else {
      handleReset();
    }
  }, [scale, handleReset]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset zoom when closing
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
          className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 border-0 bg-black/95 flex items-center justify-center overflow-hidden"
          aria-describedby={undefined}
        >
          {/* Controles de zoom */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/60 rounded-full px-3 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={scale <= MIN_SCALE}
              className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-30"
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            
            <span className="text-white text-sm font-medium min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={scale >= MAX_SCALE}
              className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-30"
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            
            <div className="w-px h-5 bg-white/30 mx-1" />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              disabled={scale === 1}
              className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-30"
              aria-label="Resetar zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Botão de fechar customizado */}
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
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
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
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
          
          {/* Dica de uso */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/60 text-xs bg-black/40 px-3 py-1.5 rounded-full">
            Scroll para zoom • Duplo-clique para alternar • Arraste para mover
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
