'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/** Display-only reveal. The complete reply remains in history and recovery storage. */
export function useAssistantTyping(open: boolean) {
  const reducedMotion = useReducedMotion();
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const active = useRef<{ id: string; characters: string[]; startedAt: number; duration: number } | null>(null);
  const replyId = reply?.id;
  const finish = useCallback(() => { active.current = null; setReply(null); }, []);
  const start = (id: string, text: string) => {
    if (!open || reducedMotion || document.hidden || !text) return;
    const characters = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), item => item.segment)
      : Array.from(text);
    active.current = { id, characters, startedAt: Date.now(), duration: Math.min(2400, Math.max(240, characters.length * 14)) };
    setReply({ id, text: '' });
  };

  useEffect(() => {
    if (!replyId) return;
    if (!open || reducedMotion || document.hidden) { finish(); return; }
    const timer = window.setInterval(() => {
      const current = active.current;
      if (!current) return;
      const progress = Math.min(1, (Date.now() - current.startedAt) / current.duration);
      if (progress >= 1) { finish(); return; }
      const count = Math.max(1, Math.floor(progress * current.characters.length));
      const text = current.characters.slice(0, count).join('');
      setReply(previous => previous?.text === text ? previous : { id: current.id, text });
    }, 32);
    const hide = () => { if (document.hidden) finish(); };
    document.addEventListener('visibilitychange', hide);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', hide); };
    // The timer owns progress; changing visible characters must not restart it.
  }, [replyId, open, reducedMotion, finish]);

  return { reply, start, finish, active };
}
