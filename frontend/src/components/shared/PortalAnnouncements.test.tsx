import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PortalAnnouncement,
  PortalAnnouncements,
  PortalAnnouncementsProvider,
  announcementPriority,
} from './PortalAnnouncements';
import AnnouncementBanner from './AnnouncementBanner';

function Shell({ count = 21, show = true }: { count?: number; show?: boolean }) {
  return (
    <PortalAnnouncementsProvider>
      <header>Portal header</header>
      <main>
        <PortalAnnouncements />
        {show && (
          <>
            <PortalAnnouncement priority={announcementPriority.plan}>
              <AnnouncementBanner variant="blue" title="Starter plan" />
            </PortalAnnouncement>
            <PortalAnnouncement priority={announcementPriority.review}>
              <AnnouncementBanner title={`${count} pending meals`} />
            </PortalAnnouncement>
            <PortalAnnouncement priority={announcementPriority.safety}>
              <AnnouncementBanner title="Safety update" />
            </PortalAnnouncement>
          </>
        )}
      </main>
    </PortalAnnouncementsProvider>
  );
}

describe('portal announcements', () => {
  it('moves notices directly under the header, orders importance and updates counts without duplicates', () => {
    const view = render(<Shell />);
    const stack = screen.getByRole('region', { name: 'Account and meal plan notices' });
    expect(stack.parentElement?.previousElementSibling?.tagName).toBe('HEADER');
    expect(stack.parentElement?.firstElementChild).toBe(stack);
    expect(
      within(stack)
        .getAllByRole('complementary')
        .map((node) => node.textContent)
    ).toEqual(['Safety update', '21 pending meals', 'Starter plan']);
    view.rerender(<Shell count={20} />);
    expect(within(stack).getByText('20 pending meals')).toBeInTheDocument();
    expect(within(stack).queryByText('21 pending meals')).not.toBeInTheDocument();
    view.rerender(<Shell show={false} />);
    expect(screen.queryByRole('region', { name: 'Account and meal plan notices' })).not.toBeInTheDocument();
  });

  it('retains page-owned actions and does not carry notices into another account', () => {
    const retry = vi.fn();
    const view = render(
      <PortalAnnouncementsProvider key="first">
        <PortalAnnouncements />
        <PortalAnnouncement priority={announcementPriority.action}>
          <AnnouncementBanner title="Retry preparation" action={{ label: 'Retry', onClick: retry }} />
        </PortalAnnouncement>
      </PortalAnnouncementsProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
    view.rerender(
      <PortalAnnouncementsProvider key="second">
        <PortalAnnouncements />
      </PortalAnnouncementsProvider>
    );
    expect(screen.queryByText('Retry preparation')).not.toBeInTheDocument();
  });
});
