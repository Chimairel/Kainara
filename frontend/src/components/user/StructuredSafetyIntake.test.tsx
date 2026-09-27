import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StructuredSafetyIntake from './StructuredSafetyIntake';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));

describe('structured safety intake loading', () => {
  it('shows the choices and the rest of the form together after the catalogue arrives', async () => {
    let finish!: (value: unknown) => void;
    mocks.get.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<StructuredSafetyIntake initialEntries={[]}
      editableDomains={['CONDITION']} submitLabel="Save and continue" onSaved={vi.fn()} />);

    expect(screen.getByText('Loading medical and food safety choices…')).toBeInTheDocument();
    expect(screen.queryByText('Common medical conditions')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save and continue' })).not.toBeInTheDocument();

    finish({ data: { data: { conditions: [{ code: 'DIABETES', displayName: 'Diabetes', domains: ['CONDITION'], aliases: [], searchTerms: [], supportState: 'SUPPORTED', policyReference: '' }], foodSafety: [] } } });
    expect(await screen.findByRole('button', { name: 'Diabetes' })).toBeInTheDocument();
    expect(screen.getByText('Common medical conditions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and continue' })).toBeInTheDocument();
  });
});
