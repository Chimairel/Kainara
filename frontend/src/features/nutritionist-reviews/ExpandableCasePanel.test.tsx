import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import ExpandableCasePanel from './ExpandableCasePanel';

function CaseFixture() {
  const [expanded, setExpanded] = useState(false);
  const [selection] = useState('Selected approval: Diabetes + shrimp allergy');
  return (
    <ThemeProvider>
      <ExpandableCasePanel expanded={expanded} onExpandedChange={setExpanded}>
        <p>{selection}</p>
      </ExpandableCasePanel>
    </ThemeProvider>
  );
}

describe('shared case viewer', () => {
  it('expands, returns with the same selection, and supports Escape', () => {
    render(<CaseFixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand case details' }));
    expect(screen.getByRole('button', { name: 'Back to split view' })).toBeInTheDocument();
    expect(screen.getByText('Selected approval: Diabetes + shrimp allergy')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Expand case details' })).toBeInTheDocument();
    expect(screen.getByText('Selected approval: Diabetes + shrimp allergy')).toBeInTheDocument();
  });
});
