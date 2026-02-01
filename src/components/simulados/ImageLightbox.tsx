import { useState, useRef, useCallback, useEffect } from 'react';
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
 * Suporta pinch-to-zoom em dispositivos touch.
 */
export const ImageLightbox = ({ src, alt, className }: ImageLightboxProps) => {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });
  
  // Touch/pinch state
  const lastTouchDistance = useRef<number | null>(null);
  const initialPinchScale = useRef(1);

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const SCALE_STEP = 0.5;

  // Prevenir zoom da página quando o modal está aberto
  useEffect(() => {
    if (!open) return;

    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventGestureZoom = (e: Event) => {
      e.preventDefault();
    };

    // Prevenir zoom por pinch em toda a página quando o lightbox está aberto
    document.addEventListener('touchmove', preventZoom, { passive: false });
    document.addEventListener('gesturestart', preventGestureZoom);
    document.addEventListener('gesturechange', preventGestureZoom);
    document.addEventListener('gestureend', preventGestureZoom);

    return () => {
      document.removeEventListener('touchmove', preventZoom);
      document.removeEventListener('gesturestart', preventGestureZoom);
      document.removeEventListener('gesturechange', preventGestureZoom);
      document.removeEventListener('gestureend', preventGestureZoom);
    };
  }, [open]);

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

  // Mouse handlers
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
    if (isDragging) return;
    
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

  // Touch handlers para pinch-to-zoom
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.touches.length === 2) {
      // Pinch start
      lastTouchDistance.current = getTouchDistance(e.touches);
      initialPinchScale.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      // Single touch drag
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      positionStart.current = { ...position };
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch zoom
      const currentDistance = getTouchDistance(e.touches);
      const scaleChange = currentDistance / lastTouchDistance.current;
      const newScale = Math.min(Math.max(initialPinchScale.current * scaleChange, MIN_SCALE), MAX_SCALE);
      
      setScale(newScale);
      
      // Reset position if returning to 1x
      if (newScale <= MIN_SCALE) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Single touch drag
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setPosition({
        x: positionStart.current.x + dx,
        y: positionStart.current.y + dy,
      });
    }
  }, [isDragging, scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length < 2) {
      lastTouchDistance.current = null;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  }, []);

  // Double tap to zoom
  const lastTapTime = useRef(0);
  const handleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;
    
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      e.preventDefault();
      if (scale === 1) {
        setScale(2.5);
      } else {
        handleReset();
      }
    }
    lastTapTime.current = now;
  }, [scale, handleReset]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      lastTouchDistance.current = null;
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
          className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 border-0 bg-black flex items-center justify-center overflow-hidden group/lightbox"
          style={{ touchAction: 'none' }}
          aria-describedby={undefined}
        >
          {/* Botão de fechar - sempre visível em touch, hover em desktop */}
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-all sm:opacity-0 sm:group-hover/lightbox:opacity-100"
            aria-label="Fechar"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          
          {/* Container da imagem com zoom e pan */}
          <div
            ref={containerRef}
            className={cn(
              "w-full h-full flex items-center justify-center overflow-hidden",
              scale > 1 ? "cursor-grab" : "cursor-zoom-in",
              isDragging && "cursor-grabbing"
            )}
            style={{ touchAction: 'none' }}
            // Mouse events
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={(e) => {
              handleClick(e);
              handleMouseUp();
            }}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            // Touch events
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={(e) => {
              handleTap(e);
              handleTouchEnd(e);
            }}
          >
            <img
              src={src}
              alt={alt}
              className="max-w-none select-none will-change-transform"
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                maxWidth: scale === 1 ? '95vw' : 'none',
                maxHeight: scale === 1 ? '95vh' : 'none',
                objectFit: 'contain',
                imageRendering: scale > 1 ? 'auto' : 'auto',
              }}
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};