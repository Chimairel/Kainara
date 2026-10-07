import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuthShell from './AuthShell';

vi.mock('@/components/ui/InteractiveCyberGrid', () => ({ default: () => null }));
vi.mock('@/components/ui/ThemeToggle', () => ({ default: () => null }));

describe('AuthShell transition', () => {
  it('retains the card and form state while blocking interaction behind the transition', () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();
    function Form() {
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return <input aria-label="Email" defaultValue="kept@example.invalid" />;
    }
    const props = {
      eyebrow: 'Welcome back',
      title: 'Sign in',
      heroTitle: 'KAINARA',
      heroDescription: 'Your nutrition',
    };
    const { rerender, container } = render(
      <AuthShell {...props}>
        <Form />
      </AuthShell>
    );
    const card = container.querySelector('.auth-card');
    expect(screen.getByText('Welcome back')).toBeVisible();
    const input = screen.getByLabelText('Email');
    rerender(
      <AuthShell {...props} transition={<p role="status">Checking your account</p>}>
        <Form />
      </AuthShell>
    );
    expect(container.querySelector('.auth-card')).toBe(card);
    expect(container.querySelector('input')).toBe(input);
    expect(input.closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('status').closest('[inert]')).toBeNull();
    expect(mounted).toHaveBeenCalledOnce();
    expect(unmounted).not.toHaveBeenCalled();
    rerender(
      <AuthShell {...props}>
        <Form />
      </AuthShell>
    );
    expect(input.closest('[inert]')).toBeNull();
    expect(input).toHaveValue('kept@example.invalid');
    expect(unmounted).not.toHaveBeenCalled();
  });
});
