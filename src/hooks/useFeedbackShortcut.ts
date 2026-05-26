import { useEffect } from 'react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';

/**
 * Shift+F global shortcut to open feedback panel.
 * Ignores when typing in form fields / contenteditable.
 */
export const useFeedbackShortcut = () => {
  const { openFeedback } = useFeedback();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'F' && e.key !== 'f') return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (t?.isContentEditable) return;
      e.preventDefault();
      openFeedback();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openFeedback]);
};
