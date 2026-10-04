import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Select } from './Select';

it('supports keyboard navigation, skips disabled entries and keeps its menu outside overflow containers', () => {
  const onChange = vi.fn();
  render(
    <div style={{ overflow: 'hidden' }} data-testid="clipping-card">
      <Select
        aria-label="Period"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'Daily' },
          { value: 'b', label: 'Unavailable', disabled: true },
          { value: 'c', label: 'Weekly' },
        ]}
      />
    </div>
  );
  const trigger = screen.getByRole('combobox', { name: 'Period' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(screen.getByTestId('clipping-card')).not.toContainElement(screen.getByRole('listbox'));
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('c');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
