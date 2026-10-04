import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminTabbedWorkspace from './AdminTabbedWorkspace';

const mocks = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn(), owner: 'admin' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => '/admin/meals',
  useSearchParams: () => mocks.params,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: mocks.owner } }) }));

function Draft({ active }: { active: boolean }) {
  const [name, setName] = useState('');
  return (
    <>
      <input aria-label="Draft name" value={name} onChange={(event) => setName(event.target.value)} />
      <span>Author active: {String(active)}</span>
    </>
  );
}
const view = () => (
  <AdminTabbedWorkspace
    title="Meals"
    description="Shared recipes and authoring"
    tabs={[
      { id: 'library', label: 'Meal library', render: (active) => <span>Library active: {String(active)}</span> },
      { id: 'author', label: 'Author meals', render: (active) => <Draft active={active} /> },
    ]}
  />
);
beforeEach(() => {
  mocks.params = new URLSearchParams();
  mocks.owner = 'admin';
  vi.clearAllMocks();
});

it('loads the requested tab, preserves drafts across switches and deactivates hidden panes', () => {
  mocks.params.set('tab', 'author');
  const rendered = render(view());
  fireEvent.change(screen.getByRole('textbox', { name: 'Draft name' }), { target: { value: 'New lunch' } });
  expect(screen.queryByText('Library active: true')).not.toBeInTheDocument();
  mocks.params.set('tab', 'library');
  rendered.rerender(view());
  expect(screen.getByText('Author active: false')).not.toBeVisible();
  expect(screen.getByText('Library active: true')).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  mocks.params.set('tab', 'author');
  rendered.rerender(view());
  expect(screen.getByRole('textbox', { name: 'Draft name' })).toHaveValue('New lunch');
});
it('uses accessible tabs and retains other URL filters when navigating', () => {
  mocks.params = new URLSearchParams('search=fish');
  render(view());
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Author meals' }), { key: 'Enter' });
  expect(mocks.replace).toHaveBeenCalledWith('/admin/meals?search=fish&tab=author', { scroll: false });
});
it('falls back for unknown tabs and clears private drafts when the account changes', () => {
  mocks.params.set('tab', 'unknown');
  const rendered = render(view());
  expect(screen.getByText('Library active: true')).toBeVisible();
  mocks.params.set('tab', 'author');
  rendered.rerender(view());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Private draft' } });
  act(() => {
    mocks.owner = 'other-admin';
    rendered.rerender(view());
  });
  expect(screen.getByRole('textbox')).toHaveValue('');
});
