import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

const mockState = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    name: 'Andrea Reyes',
    email: 'andrea@example.com',
    role: 'NUTRITIONIST' as const,
    image: null,
  },
  pathname: '/nutritionist/reviews',
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockState.user, isLoading: false }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mockState.pathname,
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Docs & Help positioned above the profile in expanded mode', () => {
    localStorage.setItem('nutrimind-sidebar-collapsed', 'false');
    render(<Sidebar />);

    const docsLink = screen.getByRole('link', { name: 'Docs & Help' });
    const profileLink = screen.getByRole('link', { name: /profile: andrea reyes/i });

    expect(docsLink).toBeInTheDocument();
    expect(docsLink).toHaveAttribute('href', '/docs');
    expect(profileLink).toBeInTheDocument();

    // Verify DOM order: docsLink must precede profileLink
    expect(docsLink.compareDocumentPosition(profileLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders Docs & Help positioned above the profile in collapsed mode', () => {
    localStorage.setItem('nutrimind-sidebar-collapsed', 'true');
    render(<Sidebar />);

    const docsLink = screen.getByRole('link', { name: 'Docs & Help' });
    const profileLink = screen.getByRole('link', { name: /profile: andrea reyes/i });

    expect(docsLink).toBeInTheDocument();
    expect(docsLink).toHaveAttribute('href', '/docs');
    expect(profileLink).toBeInTheDocument();

    // Verify DOM order: docsLink must precede profileLink
    expect(docsLink.compareDocumentPosition(profileLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
