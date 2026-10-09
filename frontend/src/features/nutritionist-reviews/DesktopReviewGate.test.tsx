import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DesktopReviewGate from './DesktopReviewGate';

afterEach(() => vi.unstubAllGlobals());
it.each([true, false])('mounts review work only with a desktop-sized viewport: %s', (matches) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  const mounted = vi.fn();
  function Workspace() {
    mounted();
    return <p>Review workspace</p>;
  }
  render(
    <DesktopReviewGate>
      <Workspace />
    </DesktopReviewGate>
  );
  expect(mounted.mock.calls.length > 0).toBe(matches);
  if (!matches) expect(screen.getByRole('heading', { name: 'Use a desktop to review meals' })).toBeInTheDocument();
});
