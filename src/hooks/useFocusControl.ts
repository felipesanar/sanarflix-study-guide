import { useEffect, useCallback, useState } from 'react';

interface UseFocusControlProps {
  onSaidaAba: () => void;
  onRetornoAba: () => void;
}

export const useFocusControl = ({
  onSaidaAba,
  onRetornoAba
}: UseFocusControlProps) => {
  const [foraDeAba, setForaDeAba] = useState(false);
  const [foraDeTelaCheia, setForaDeTelaCheia] = useState(false);
  const [podeInteragir, setPodeInteragir] = useState(true);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      setForaDeAba(true);
      onSaidaAba(); // Apenas registra log, não pausa cronômetro
      setPodeInteragir(false); // Bloqueia interação
    } else {
      setForaDeAba(false);
      onRetornoAba();
      // Só permite interação novamente se estiver em fullscreen
      setPodeInteragir(!!document.fullscreenElement);
    }
  }, [onSaidaAba, onRetornoAba]);

  const handleFullscreenChange = useCallback(() => {
    const isFullscreen = !!document.fullscreenElement;
    setForaDeTelaCheia(!isFullscreen);
    
    if (!isFullscreen) {
      onSaidaAba(); // Apenas registra log
      setPodeInteragir(false); // Bloqueia interação ao sair do fullscreen
    } else {
      onRetornoAba();
      setPodeInteragir(true); // Permite interação ao entrar em fullscreen
    }
  }, [onSaidaAba, onRetornoAba]);

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
