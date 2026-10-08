import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReviewedByControl from './ReviewedByControl';
import { NutritionistCredentialCard } from './NutritionistCredentialCard';
describe('recorded RND attribution', () => {
  it('opens credentials without opening the surrounding meal and distinguishes member approval', () => {
    const openMeal = vi.fn(),
      openCredentials = vi.fn();
    render(
      <div onClick={openMeal}>
        <ReviewedByControl name="Synthetic Reviewer, RND" scope="MEMBER" onClick={openCredentials} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Reviewed by Synthetic Reviewer, RND/ }));
    expect(openCredentials).toHaveBeenCalledOnce();
    expect(openMeal).not.toHaveBeenCalled();
    expect(screen.getByText(/Your meal approval/)).toBeInTheDocument();
  });
  it('labels missing credentials without inventing institutions, specialties, degrees or experience', () => {
    render(
      <NutritionistCredentialCard
        verifier={{ name: 'Synthetic Reviewer', prcLicenseNumber: '', prcLicenseExpiry: '' }}
      />
    );
    expect(screen.getAllByText('Not recorded')).toHaveLength(3);
    expect(screen.getByText('PRC license not recorded')).toBeInTheDocument();
    expect(
      screen.queryByText(/University of the Philippines|5\+ years|BS Nutrition and Dietetics|Metabolic Health/)
    ).not.toBeInTheDocument();
  });
  it('preserves recorded zero experience', () => {
    render(
      <NutritionistCredentialCard
        verifier={{
          name: 'Synthetic Reviewer',
          prcLicenseNumber: '123456',
          prcLicenseExpiry: '2099-01-01',
          yearsOfExperience: 0,
        }}
      />
    );
    expect(screen.getByText('0 years')).toBeInTheDocument();
  });
});
