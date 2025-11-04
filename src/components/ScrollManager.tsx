import * as React from 'react';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Preserva posição de scroll por rota para evitar flickering ao navegar
export const ScrollManager: React.FC = () => {
  const location = useLocation();
  const prevPathRef = useRef<string>(location.pathname);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    // Salvar posição da rota anterior
    try {
      const prevPos = window.scrollY;
      sessionStorage.setItem(`scroll:${prevPath}`, String(prevPos));
    } catch {}

    // Restaurar posição da nova rota
    const key = `scroll:${location.pathname}`;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const y = parseInt(saved, 10) || 0;
      // Restaurar após render para evitar layout shift
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      });
    } else {
      // Por padrão, manter no topo sem animação para evitar flicker
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      });
    }

    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  return null;
};