import { useEffect, useState } from 'react';

export function useCallDue(scheduledCallAt?: string) {
  const [now, setNow] = useState(Date.now);
  const deadline = scheduledCallAt ? new Date(scheduledCallAt).getTime() : NaN;
  useEffect(() => {
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      if (Number.isFinite(deadline) && current < deadline) {
        timer = window.setTimeout(update, Math.min(deadline - current + 1, 60000));
      }
    };
    update();
    window.addEventListener('focus', update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', update);
    };
  }, [deadline]);
  return Number.isFinite(deadline) && deadline <= now;
}
