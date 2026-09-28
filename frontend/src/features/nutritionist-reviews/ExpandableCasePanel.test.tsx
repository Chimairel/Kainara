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

  it('renders headerLeft on the upper left in split and expanded views', () => {
    function HeaderFixture() {
      const [expanded, setExpanded] = useState(false);
      return (
        <ThemeProvider>
          <ExpandableCasePanel
            expanded={expanded}
            onExpandedChange={setExpanded}
            headerLeft={<button type="button">Claim review</button>}
          >
            <p>Case content</p>
          </ExpandableCasePanel>
        </ThemeProvider>
      );
    }
    render(<HeaderFixture />);
    expect(screen.getByRole('button', { name: 'Claim review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand case details' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand case details' }));
    expect(screen.getByRole('button', { name: 'Back to split view' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Claim review' }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders mobile back button in mini navbar when onBack is provided', () => {
    let backClicked = false;
    render(
      <ThemeProvider>
        <ExpandableCasePanel
          expanded={false}
          onExpandedChange={() => {}}
          onBack={() => { backClicked = true; }}
          headerLeft={<span>Review Case</span>}
        >
          <p>Details</p>
        </ExpandableCasePanel>
      </ThemeProvider>
    );

    const backButton = screen.getByRole('button', { name: 'Back to queue' });
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(backClicked).toBe(true);
  });
});
