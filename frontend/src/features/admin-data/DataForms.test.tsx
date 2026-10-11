import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import api from '@/lib/axios';
import DataForms from './DataForms';

vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));

describe('data administration form completion', () => {
  it('resets the source form after its asynchronous save without using a released React event', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    const changed = vi.fn().mockResolvedValue(undefined),
      failed = vi.fn();
    render(<DataForms sources={[]} onChanged={changed} onError={failed} />);
    const input = screen.getByLabelText('Source code');
    fireEvent.change(input, { target: { value: 'TEST_SOURCE' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(changed).toHaveBeenCalledWith('Reference source created.'));
    expect(failed).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });
});
