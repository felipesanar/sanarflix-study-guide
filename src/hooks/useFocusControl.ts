import { useEffect, useCallback, useState } from 'react';

interface UseFocusControlProps {
  onSaidaAba: () => void;
  onRetornoAba: () => void;
  pausarAoSair?: boolean;
}

export const useFocusControl = ({
  onSaidaAba,
  onRetornoAba,
  pausarAoSair = true
}: UseFocusControlProps) => {
  const [foraDeAba, setForaDeAba] = useState(false);
  const [foraDeTelaCheia, setForaDeTelaCheia] = useState(false);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      setForaDeAba(true);
      if (pausarAoSair) {
        onSaidaAba();
      }
    } else {
      setForaDeAba(false);
      onRetornoAba();
    }
  }, [onSaidaAba, onRetornoAba, pausarAoSair]);

  const handleFullscreenChange = useCallback(() => {
    const isFullscreen = !!document.fullscreenElement;
    setForaDeTelaCheia(!isFullscreen);
    
    if (!isFullscreen && pausarAoSair) {
      onSaidaAba();
    } else if (isFullscreen) {
      onRetornoAba();
    }
  }, [onSaidaAba, onRetornoAba, pausarAoSair]);

  const entrarTelaCheia = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setForaDeTelaCheia(false);
    } catch (error) {
      console.error('Erro ao entrar em tela cheia:', error);
    }
  }, []);

  const sairTelaCheia = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Erro ao sair de tela cheia:', error);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [handleVisibilityChange, handleFullscreenChange]);

  return {
    foraDeAba,
    foraDeTelaCheia,
    entrarTelaCheia,
    sairTelaCheia
  };
};
