import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Leitura por voz (TTS) via Web Speech API, pt-BR. Degrada silenciosamente
 * quando não suportado. Para a fala ao desmontar.
 */
export function useTextToSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const supportedRef = useRef(supported);

  const stop = useCallback(() => {
    if (supportedRef.current) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!supportedRef.current || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, []);

  // para a fala ao desmontar
  useEffect(() => () => { if (supportedRef.current) window.speechSynthesis.cancel(); }, []);

  return { supported, speaking, speak, stop };
}
