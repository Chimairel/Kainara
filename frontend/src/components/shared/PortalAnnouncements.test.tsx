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
            <PortalAnnouncement priority={announcementPriority.safety} summary="Safety update">
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
    const disclosure = stack.querySelector('details')!;
    expect(disclosure.open).toBe(false);
    expect(within(stack).getByText('View updates')).toBeInTheDocument();
    expect(disclosure.querySelector('summary')?.textContent).toContain('Safety update');
    disclosure.open = true;
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
    screen.getByRole('region', { name: 'Account and meal plan notices' }).querySelector('details')!.open = true;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
    view.rerender(
      <PortalAnnouncementsProvider key="second">
        <PortalAnnouncements />
      </PortalAnnouncementsProvider>
    );
    expect(screen.queryByText('Retry preparation')).not.toBeInTheDocument();
  });

  it('keeps disclosure and action focus when a notice summary changes', () => {
    const retry = vi.fn();
    const renderNotice = (summary: string) => (
      <PortalAnnouncementsProvider>
        <PortalAnnouncements />
        <PortalAnnouncement priority={announcementPriority.action} summary={summary}>
          <AnnouncementBanner title="Retry preparation" action={{ label: 'Retry', onClick: retry }} />
        </PortalAnnouncement>
      </PortalAnnouncementsProvider>
    );
    const view = render(renderNotice('Three meal slots need attention'));
    const disclosure = screen.getByRole('region', { name: 'Account and meal plan notices' }).querySelector('details')!;
    disclosure.open = true;
    const action = screen.getByRole('button', { name: 'Retry' });
    action.focus();
    view.rerender(renderNotice('Two meal slots need attention'));
    expect(disclosure.open).toBe(true);
    expect(screen.getByRole('button', { name: 'Retry' })).toBe(action);
    expect(action).toHaveFocus();
    expect(disclosure.querySelector('summary')?.textContent).toContain('Two meal slots need attention');
  });
});
