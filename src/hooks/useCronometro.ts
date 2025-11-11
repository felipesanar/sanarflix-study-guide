import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCronometroProps {
  tempoInicialSegundos: number;
  onTempoEsgotado: () => void;
  onAtualizarTempo: (tempo: number) => void;
}

export const useCronometro = ({
  tempoInicialSegundos,
  onTempoEsgotado,
  onAtualizarTempo
}: UseCronometroProps) => {
  const [tempoRestante, setTempoRestante] = useState(tempoInicialSegundos);
  const [pausado, setPausado] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const pausar = useCallback(() => {
    setPausado(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const retomar = useCallback(() => {
    setPausado(false);
  }, []);

  useEffect(() => {
    if (pausado || tempoRestante <= 0) return;

    intervalRef.current = setInterval(() => {
      setTempoRestante(prev => {
        const novoTempo = Math.max(0, prev - 1);
        onAtualizarTempo(novoTempo);
        
        if (novoTempo === 0) {
          onTempoEsgotado();
        }
        
        return novoTempo;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pausado, tempoRestante, onAtualizarTempo, onTempoEsgotado]);

  const formatarTempo = (segundos: number): string => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  };

  const getCorTempo = (): string => {
    if (tempoRestante < 60) return 'text-red-500';
    if (tempoRestante < 300) return 'text-orange-500';
    return 'text-foreground';
  };

  return {
    tempoRestante,
    pausado,
    pausar,
    retomar,
    formatarTempo,
    getCorTempo
  };
};
