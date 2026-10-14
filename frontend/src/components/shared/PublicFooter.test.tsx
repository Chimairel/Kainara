import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PublicFooter from './PublicFooter';
vi.mock('@/components/landing/LandingWaveRiver', () => ({ SectionWaveBorderTop: () => null }));
vi.mock('@/components/shared/KainaraLogo', () => ({ default: () => <span>Kainara logo</span> }));

it('keeps public resources, legal links and contact email without exposing portal links or office claims', () => {
  render(<PublicFooter />);
  const footer = within(screen.getByRole('contentinfo'));
  expect(footer.getByText('Resources', { exact: true })).toBeInTheDocument();
  expect(footer.getByText('Quick Links', { exact: true })).toBeInTheDocument();
  expect(footer.getByText('Clinical Evidence', { exact: true })).toBeInTheDocument();
  expect(footer.getByRole('link', { name: 'Apply as an RND' })).toHaveAttribute('href', '/nutritionist-apply');
  expect(footer.getByRole('link', { name: 'Track RND Application' })).toHaveAttribute(
    'href',
    '/nutritionist-apply#track'
  );
  expect(footer.getByRole('link', { name: 'chimairelp@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:chimairelp@gmail.com'
  );
  expect(footer.getByText('For questions, feedback, or account support.')).toBeInTheDocument();
  expect(footer.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  expect(footer.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/docs#privacy-policy');
  expect(footer.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/docs#terms-of-service');
  expect(footer.getByRole('link', { name: 'CC BY 4.0' })).toBeInTheDocument();
  expect(
    screen.getByRole('contentinfo').querySelector('a[href^="/admin"], a[href^="/dashboard"], a[href^="/nutritionist/"]')
  ).toBeNull();
  expect(
    footer.queryByText(/Clinical Operations|Cebu, Philippines|Review Desk Hours|Portal Login|Workspaces/)
  ).not.toBeInTheDocument();
});
it('retains back-to-top and honors reduced motion', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }))
  );
  render(<PublicFooter />);
  fireEvent.click(screen.getByRole('button', { name: 'Scroll to top of page' }));
  expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  scroll.mockRestore();
  vi.unstubAllGlobals();
});
