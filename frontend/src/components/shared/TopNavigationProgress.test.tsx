import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TopNavigationProgress from './TopNavigationProgress';
import Skeleton from '@/components/ui/Skeleton';
import PortalLoadingState from './PortalLoadingState';
import { getPageLoadingCount } from '@/lib/page-loading';

const route = vi.hoisted(() => ({ pathname: '/dashboard', search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.search),
}));

function Fixture({ href = '/meals', download, target }: { href?: string; download?: string; target?: string }) {
  return (
    <>
      <TopNavigationProgress />
      <a href={href} download={download} target={target} onClick={(event) => event.preventDefault()}>
        Action
      </a>
    </>
  );
}

describe('TopNavigationProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    route.pathname = '/dashboard';
    route.search = '';
    window.history.replaceState({}, '', '/dashboard');
  });
  afterEach(() => vi.useRealTimers());

  it('stays hidden when idle, then completes after an internal route commits', () => {
    const { container, rerender } = render(<Fixture />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    fireEvent.click(screen.getByText('Action'));
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(120));
    expect(container.querySelector('[aria-hidden="true"] > div')).not.toHaveStyle({ width: '100%' });
    route.pathname = '/meals';
    rerender(<Fixture />);
    act(() => vi.advanceTimersByTime(250));
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('completes when only the query changes', () => {
    const { container, rerender } = render(<Fixture href="/dashboard?day=next" />);
    fireEvent.click(screen.getByText('Action'));
    route.search = 'day=next';
    rerender(<Fixture href="/dashboard?day=next" />);
    act(() => vi.advanceTimersByTime(250));
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it.each([
    { href: '/api/user/grocery/pdf', download: 'grocery.pdf' },
    { href: '/api/user/nutrition-report/pdf', download: '' },
    { href: 'blob:http://localhost:3000/temporary-pdf' },
    { href: 'data:application/pdf;base64,JVBERi0=' },
    { href: 'https://example.com' },
    { href: '#section' },
    { href: '/dashboard#section' },
    { href: '/meals', target: '_blank' },
    { href: '/meals', target: 'document-preview' },
  ])('ignores downloads, previews and non-route links: %j', (props) => {
    const { container } = render(<Fixture {...props} />);
    fireEvent.click(screen.getByText('Action'));
    act(() => vi.advanceTimersByTime(5000));
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores modifier clicks and cleans up a pending animation on unmount', () => {
    const { container, unmount } = render(<Fixture />);
    fireEvent.click(screen.getByText('Action'), { ctrlKey: true });
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    fireEvent.click(screen.getByText('Action'));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts on a direct page load and waits for every visible loading region', () => {
    const Page = ({ count }: { count: number }) => (
      <>
        <TopNavigationProgress />
        {Array.from({ length: count }, (_, index) => (
          <Skeleton key={index} />
        ))}
      </>
    );
    const { container, rerender } = render(<Page count={2} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(container.querySelector('[data-navigation-progress]')).toHaveAttribute('data-progress-active', 'true');
    rerender(<Page count={1} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(container.querySelector('[data-navigation-progress]')).toHaveAttribute('data-progress-active', 'true');
    rerender(<Page count={0} />);
    act(() => vi.advanceTimersByTime(250));
    expect(container.querySelector('[data-navigation-progress]')).toBeNull();
  });

  it('keeps loading after the route commits, then stops when a failure replaces the placeholder', () => {
    const Page = ({ loading }: { loading: boolean }) => (
      <>
        <TopNavigationProgress />
        <a href="/meals" onClick={(event) => event.preventDefault()}>
          Open meals
        </a>
        {loading ? <PortalLoadingState /> : <p role="alert">Could not load. Try again.</p>}
      </>
    );
    const { container, rerender } = render(<Page loading={false} />);
    fireEvent.click(screen.getByText('Open meals'));
    route.pathname = '/meals';
    rerender(<Page loading />);
    act(() => vi.advanceTimersByTime(2000));
    expect(container.querySelector('[data-navigation-progress]')).toHaveAttribute('data-progress-active', 'true');
    rerender(<Page loading={false} />);
    act(() => vi.advanceTimersByTime(250));
    expect(container.querySelector('[data-navigation-progress]')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Try again');
  });

  it('cleans up loading ownership in strict mode and times out an abandoned navigation', () => {
    const { unmount } = render(
      <React.StrictMode>
        <TopNavigationProgress />
        <Skeleton />
      </React.StrictMode>
    );
    expect(getPageLoadingCount()).toBe(1);
    unmount();
    expect(getPageLoadingCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    const { container } = render(<Fixture />);
    fireEvent.click(screen.getByText('Action'));
    act(() => vi.advanceTimersByTime(30000));
    act(() => vi.advanceTimersByTime(250));
    expect(container.querySelector('[data-navigation-progress]')).toBeNull();
  });
});
