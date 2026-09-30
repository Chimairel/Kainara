import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CapstoneDemoNotice from './CapstoneDemoNotice';

describe('capstone deployment notice', () => {
  it('clearly identifies the capstone demonstration without an approval claim', () => {
    render(<CapstoneDemoNotice mode="capstone-demo" />);
    expect(screen.getByRole('note', { name: 'Capstone demo' })).toHaveTextContent(
      'Not clinically approved. Use test data only.'
    );
  });
  it('does not display a demo notice on ordinary deployments', () => {
    render(<CapstoneDemoNotice mode="public" />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
