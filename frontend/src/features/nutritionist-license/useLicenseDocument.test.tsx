import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useLicenseDocument } from './useLicenseDocument';
import type { LicenseUpdate } from './types';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get } }));
const record = { id: 'proof', originalFileName: 'license.pdf' } as LicenseUpdate;
it('does not start a late document download after account switching', async () => {
  let resolve!: (value: unknown) => void;
  mocks.get.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    })
  );
  const create = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() });
  const hook = renderHook(({ owner }) => useLicenseDocument(owner, 'nutritionist'), {
    initialProps: { owner: 'rnd-a' },
  });
  let pending!: Promise<unknown>;
  act(() => {
    pending = hook.result.current.download(record);
  });
  hook.rerender({ owner: 'rnd-b' });
  await act(async () => {
    resolve({ data: new Blob(['private']) });
    await pending;
  });
  expect(create).not.toHaveBeenCalled();
  hook.unmount();
  vi.unstubAllGlobals();
});
it('does not start a late document download after logout/unmount', async () => {
  let resolve!: (value: unknown) => void;
  mocks.get.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    })
  );
  const create = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() });
  const hook = renderHook(() => useLicenseDocument('rnd-a', 'nutritionist'));
  let pending!: Promise<unknown>;
  act(() => {
    pending = hook.result.current.download(record);
  });
  hook.unmount();
  await act(async () => {
    resolve({ data: new Blob(['private']) });
    await pending;
  });
  expect(create).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
