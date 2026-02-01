import { useState } from 'react';
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
 * Ao clicar, abre dialog fullscreen com imagem ampliada.
 */
export const ImageLightbox = ({ src, alt, className }: ImageLightboxProps) => {
  const [open, setOpen] = useState(false);

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 border-0 bg-black/95 flex items-center justify-center"
          aria-describedby={undefined}
        >
          {/* Botão de fechar customizado */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
