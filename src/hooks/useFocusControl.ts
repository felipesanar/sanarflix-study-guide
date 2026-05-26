import { useEffect, useCallback, useState, useRef } from 'react';
import { Logger } from '@/utils/logger';

interface UseFocusControlProps {
  onSaidaAba: () => void;
  onRetornoAba: () => void;
  onSaidaFullscreen?: () => void;
}

export const useFocusControl = ({
  onSaidaAba,
  onRetornoAba,
  onSaidaFullscreen
}: UseFocusControlProps) => {
  const [foraDeAba, setForaDeAba] = useState(false);
  const [foraDeTelaCheia, setForaDeTelaCheia] = useState(false);
  const [podeInteragir, setPodeInteragir] = useState(true);
  
  // Ref para tracking real-time do estado fullscreen (evita stale closure)
  const wasInFullscreenRef = useRef(false);

  // Sincroniza ref com estado atual do fullscreen na montagem
  useEffect(() => {
    wasInFullscreenRef.current = !!document.fullscreenElement;
  }, []);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      setForaDeAba(true);
      onSaidaAba();
      setPodeInteragir(false);
    } else {
      setForaDeAba(false);
      onRetornoAba();
      setPodeInteragir(!!document.fullscreenElement);
    }
  }, [onSaidaAba, onRetornoAba]);

  const handleFullscreenChange = useCallback(() => {
    const isFullscreen = !!document.fullscreenElement;
    const wasInFullscreen = wasInFullscreenRef.current;
    
    // Atualiza ref ANTES de qualquer callback
    wasInFullscreenRef.current = isFullscreen;
    
    setForaDeTelaCheia(!isFullscreen);
    
    // Detecta saída: estava em fullscreen e agora não está
    if (wasInFullscreen && !isFullscreen && onSaidaFullscreen) {
      Logger.info('[FocusControl] Saída de fullscreen detectada');
      onSaidaFullscreen();
    }
    
    // Bloqueia interação fora do fullscreen, permite dentro
    setPodeInteragir(isFullscreen && !document.hidden);
  }, [onSaidaFullscreen]); // Removido foraDeTelaCheia das deps

  const entrarTelaCheia = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setForaDeTelaCheia(false);
    } catch (error) {
      Logger.error('Erro ao entrar em tela cheia:', error);
    }
  }, []);

  const sairTelaCheia = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      Logger.error('Erro ao sair de tela cheia:', error);
    }
  }, []);

  useEffect(() => {
    // Suporte cross-browser para eventos de fullscreen
    const fullscreenEvents = [
      'fullscreenchange',
      'webkitfullscreenchange', // Safari
      'mozfullscreenchange'     // Firefox antigo
    ];

    document.addEventListener('visibilitychange', handleVisibilityChange);
    fullscreenEvents.forEach(event => {
      document.addEventListener(event, handleFullscreenChange);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      fullscreenEvents.forEach(event => {
        document.removeEventListener(event, handleFullscreenChange);
      });
    };
  }, [handleVisibilityChange, handleFullscreenChange]);

  return {
    foraDeAba,
    foraDeTelaCheia,
    podeInteragir,
    entrarTelaCheia,
    sairTelaCheia
  };
};
