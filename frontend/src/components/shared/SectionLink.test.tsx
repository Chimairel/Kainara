import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SectionLink from './SectionLink';
afterEach(() => vi.unstubAllGlobals());

it('scrolls to landing sections without adding a hash to browser history', () => {
  history.replaceState(null, '', '/');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  );
  const scroll = vi.fn();
  render(
    <>
      <SectionLink href="/#platform">Platform section</SectionLink>
      <section id="platform">Platform content</section>
    </>
  );
  document.getElementById('platform')!.scrollIntoView = scroll;
  fireEvent.click(screen.getByRole('link', { name: 'Platform section' }));
  expect(scroll).toHaveBeenCalled();
  expect(location.hash).toBe('');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/#platform');
});
