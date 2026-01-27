import { useEffect, useCallback, useState } from 'react';

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

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      setForaDeAba(true);
      onSaidaAba();
      setPodeInteragir(false); // Bloqueia interação quando sai da aba
    } else {
      setForaDeAba(false);
      onRetornoAba();
      // Ao retornar à aba, permite interação apenas se estiver em fullscreen
      setPodeInteragir(!!document.fullscreenElement);
    }
  }, [onSaidaAba, onRetornoAba]);

  const handleFullscreenChange = useCallback(() => {
    const isFullscreen = !!document.fullscreenElement;
    const wasInFullscreen = !foraDeTelaCheia;
    
    setForaDeTelaCheia(!isFullscreen);
    
    // Registra saída do fullscreen (apenas quando sai, não quando entra)
    if (wasInFullscreen && !isFullscreen && onSaidaFullscreen) {
      onSaidaFullscreen();
    }
    
    // Bloqueia interação fora do fullscreen, permite dentro
    setPodeInteragir(isFullscreen && !document.hidden);
  }, [foraDeTelaCheia, onSaidaFullscreen]);

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
    podeInteragir,
    entrarTelaCheia,
    sairTelaCheia
  };
};
