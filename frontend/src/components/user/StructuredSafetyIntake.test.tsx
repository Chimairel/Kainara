import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StructuredSafetyIntake from './StructuredSafetyIntake';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));

describe('structured safety intake loading', () => {
  it('shows the choices and the rest of the form together after the catalogue arrives', async () => {
    let finish!: (value: unknown) => void;
    mocks.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(
      <StructuredSafetyIntake
        initialEntries={[]}
        editableDomains={['CONDITION']}
        submitLabel="Save and continue"
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText('Loading medical and food safety choices…')).toBeInTheDocument();
    expect(screen.queryByText('Common medical conditions')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save and continue' })).not.toBeInTheDocument();

    finish({
      data: {
        data: {
          conditions: [
            {
              code: 'DIABETES',
              displayName: 'Diabetes',
              domains: ['CONDITION'],
              aliases: [],
              searchTerms: [],
              supportState: 'SUPPORTED',
              policyReference: '',
            },
          ],
          foodSafety: [],
        },
      },
    });
    expect(await screen.findByRole('button', { name: 'Diabetes' })).toBeInTheDocument();
    expect(screen.getByText('Common medical conditions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and continue' })).toBeInTheDocument();
  });

  it('highlights a recorded Diabetes condition in the profile editor', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        data: {
          conditions: [
            {
              code: 'DIABETES',
              displayName: 'Diabetes',
              domains: ['CONDITION'],
              aliases: [],
              searchTerms: [],
              supportState: 'SUPPORTED',
              policyReference: '',
            },
          ],
          foodSafety: [],
        },
      },
    });
    render(
      <StructuredSafetyIntake
        initialEntries={[{ domain: 'CONDITION', value: 'DIABETES', provenance: 'PREDEFINED' }]}
        editableDomains={['CONDITION']}
        submitLabel="Save safety changes"
        onSaved={vi.fn()}
      />
    );
    expect(await screen.findByRole('button', { name: 'Diabetes' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('onboarding section saves', () => {
  it('sends only food-safety entries when the prior condition is absent from a stale screen snapshot', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        data: {
          conditions: [],
          foodSafety: [
            {
              code: 'NONE',
              displayName: 'None',
              domains: ['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'],
              aliases: [],
              searchTerms: [],
              supportState: 'SUPPORTED',
              policyReference: '',
            },
          ],
        },
      },
    });
    mocks.post.mockResolvedValueOnce({
      data: { data: { entries: [], errors: [], canSave: true, requiresReview: false } },
    });
    render(
      <StructuredSafetyIntake
        initialEntries={[
          { domain: 'ALLERGY', value: 'NONE', provenance: 'PREDEFINED' },
          { domain: 'INTOLERANCE', value: 'NONE', provenance: 'PREDEFINED' },
          { domain: 'AVOIDED_INGREDIENT', value: 'NONE', provenance: 'PREDEFINED' },
        ]}
        editableDomains={['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT']}
        submitLabel="Save and continue"
        onSaved={vi.fn()}
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Save and continue' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/user/onboarding/safety-preview', {
        entries: [
          { domain: 'ALLERGY', value: 'NONE', provenance: 'PREDEFINED' },
          { domain: 'INTOLERANCE', value: 'NONE', provenance: 'PREDEFINED' },
          { domain: 'AVOIDED_INGREDIENT', value: 'NONE', provenance: 'PREDEFINED' },
        ],
        editableDomains: ['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'],
      })
    );
  });
});
