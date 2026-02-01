import { useState, useEffect, useRef, useCallback } from 'react';
import { getBrazilDate } from '@/utils/timezone';

interface UseCronometroProps {
  dataEncerramento: string | null;
  onTempoEsgotado: () => void;
}

export const useCronometro = ({
  dataEncerramento,
  onTempoEsgotado
}: UseCronometroProps) => {
  const calcularTempoRestante = useCallback((): number => {
    if (!dataEncerramento) return 0;
    
    const agora = getBrazilDate();
    const deadline = new Date(dataEncerramento);
    const diffMs = deadline.getTime() - agora.getTime();
    
    return Math.max(0, Math.floor(diffMs / 1000));
  }, [dataEncerramento]);

  const [tempoRestante, setTempoRestante] = useState(() => calcularTempoRestante());
  const [pausado, setPausado] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tempoEsgotadoRef = useRef(false);
  
  // Ref para callback - evita re-criação do intervalo
  const onTempoEsgotadoRef = useRef(onTempoEsgotado);
  useEffect(() => {
    onTempoEsgotadoRef.current = onTempoEsgotado;
  }, [onTempoEsgotado]);

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
    if (pausado || !dataEncerramento) return;

    const atualizarTempo = () => {
      const novoTempo = calcularTempoRestante();
      setTempoRestante(novoTempo);
      
      if (novoTempo === 0 && !tempoEsgotadoRef.current) {
        tempoEsgotadoRef.current = true;
        onTempoEsgotadoRef.current();
      }
    };

    atualizarTempo();
    intervalRef.current = setInterval(atualizarTempo, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pausado, dataEncerramento, calcularTempoRestante]);

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
