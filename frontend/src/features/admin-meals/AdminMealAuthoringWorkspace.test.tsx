import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import AdminMealAuthoringWorkspace from './AdminMealAuthoringWorkspace';
const mocks = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => '/admin/meals',
}));
function Draft({ active, label }: { active: boolean; label: string }) {
  const [value, setValue] = useState('');
  return (
    <>
      <input aria-label={label} value={value} onChange={(e) => setValue(e.target.value)} />
      <span>
        {label} active {String(active)}
      </span>
    </>
  );
}
vi.mock('./AdminMealAuthoring', () => ({
  default: (props: { active: boolean }) => <Draft {...props} label="single" />,
}));
vi.mock('./AdminMealBatch', () => ({ default: (props: { active: boolean }) => <Draft {...props} label="batch" /> }));
beforeEach(() => {
  mocks.params = new URLSearchParams('tab=author&search=rice');
  vi.clearAllMocks();
});
it('nests two authoring methods, preserves drafts and maintains URL filters', () => {
  const view = render(<AdminMealAuthoringWorkspace active />);
  fireEvent.change(screen.getByRole('textbox', { name: 'single' }), { target: { value: 'Saved single draft' } });
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Batch JSON' }), { key: 'Enter' });
  expect(mocks.replace).toHaveBeenCalledWith('/admin/meals?tab=author&search=rice&mode=batch', { scroll: false });
  mocks.params.set('mode', 'batch');
  view.rerender(<AdminMealAuthoringWorkspace active />);
  fireEvent.change(screen.getByRole('textbox', { name: 'batch' }), { target: { value: 'Saved batch draft' } });
  expect(screen.getByText('single active false')).not.toBeVisible();
  mocks.params.delete('mode');
  view.rerender(<AdminMealAuthoringWorkspace active />);
  expect(screen.getByRole('textbox', { name: 'single' })).toHaveValue('Saved single draft');
  mocks.params.set('mode', 'batch');
  view.rerender(<AdminMealAuthoringWorkspace active />);
  expect(screen.getByRole('textbox', { name: 'batch' })).toHaveValue('Saved batch draft');
});
it('opens old batch URLs directly in the new batch authoring method', () => {
  mocks.params = new URLSearchParams('tab=batch');
  render(<AdminMealAuthoringWorkspace active />);
  expect(screen.getByRole('tab', { name: 'Batch JSON' })).toHaveAttribute('data-state', 'active');
  expect(screen.getByRole('textbox', { name: 'batch' })).toBeVisible();
});
