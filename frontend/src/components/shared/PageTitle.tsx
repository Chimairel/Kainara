'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { getPageTitle } from '@/lib/page-title';

export default function PageTitle() {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();
  const title = getPageTitle(pathname ?? '/', unreadCount);

  useEffect(() => {
    const updateTitle = () => {
      if (document.title !== title) document.title = title;
    };
    updateTitle();
    // Next can deliver route metadata after navigation; retain the live unread prefix.
    const observer = new MutationObserver(updateTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);

  return null;
}
