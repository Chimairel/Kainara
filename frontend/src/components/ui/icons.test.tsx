import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Check, Home, Loader2, ShieldAlert } from './icons';

it('inherits control color and retains accessible button labels, refs and events', () => {
  const click = vi.fn();
  const ref = createRef<SVGSVGElement>();
  render(
    <button onClick={click} aria-label="Confirm meal" style={{ color: 'rgb(8, 112, 91)' }}>
      <Check ref={ref} className="h-4 w-4" />
    </button>
  );
  const control = screen.getByRole('button', { name: 'Confirm meal' });
  expect(ref.current).toHaveAttribute('aria-hidden', 'true');
  expect(ref.current).toHaveClass('solar-check-bold', 'h-4', 'w-4');
  expect(ref.current).toHaveAttribute('color', 'var(--solar-color, currentColor)');
  fireEvent.click(control);
  expect(click).toHaveBeenCalledOnce();
});

it('keeps explicit dimensions and caller-supplied status colors', () => {
  const { container } = render(<ShieldAlert size={18} color="var(--status-error-text)" aria-label="Review required" />);
  const icon = screen.getByLabelText('Review required');
  expect(icon).not.toHaveAttribute('aria-hidden');
  expect(icon).toHaveStyle({ width: '18px', height: '18px', color: 'var(--status-error-text)' });
  expect(container.querySelector('svg')).toHaveClass('solar-shield-warning-bold');
});

it('uses filled duotone for context and preserves animated loader classes', () => {
  const { container } = render(
    <>
      <Home className="h-5 w-5 text-brand-muted" />
      <Loader2 className="h-4 w-4 animate-spin" />
    </>
  );
  expect(container.querySelector('.solar-home-angle-bold-duotone')).toHaveClass('app-icon-duotone');
  expect(container.querySelector('.solar-refresh-bold')).toHaveClass('animate-spin');
});

it('allows callers to customize both duotone layers without changing control semantics', () => {
  const { container } = render(<Home color="#08705b" secondaryColor="#eb6a38" secondaryOpacity={0.8} size={24} />);
  expect(container.querySelector('svg')).toHaveStyle({
    color: '#08705b',
    '--solar-secondary-color': '#eb6a38',
    '--solar-secondary-opacity': '0.8',
  });
});
