import { beforeEach, expect, it, vi } from 'vitest';
import { refreshUserProfile } from './user-profile-resource';
import { clearSessionResourceCache } from './session-resource-cache';
const mocks = vi.hoisted(() => ({ get: vi.fn(), owner: 'member' }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get } }));
vi.mock('@/lib/auth', () => ({
  cookieHelper: { get: () => 'synthetic' },
  decodeToken: () => ({ userId: mocks.owner }),
}));
beforeEach(() => {
  clearSessionResourceCache();
  vi.clearAllMocks();
  mocks.owner = 'member';
});
it('shares one bounded transient retry and returns only the fresh successful profile', async () => {
  mocks.get
    .mockRejectedValueOnce({ code: 'ECONNABORTED' })
    .mockResolvedValueOnce({ data: { success: true, data: { id: 'member' } } });
  const first = refreshUserProfile('member');
  const second = refreshUserProfile('member');
  expect(first).toBe(second);
  await expect(first).resolves.toEqual({ id: 'member' });
  expect(mocks.get.mock.calls.map((call) => call[1].timeout)).toEqual([45000, 15000]);
});
it('does not retry authorization failures or switch the retry into another account', async () => {
  mocks.get.mockRejectedValueOnce({ response: { status: 401 } });
  await expect(refreshUserProfile('member')).rejects.toMatchObject({ response: { status: 401 } });
  expect(mocks.get).toHaveBeenCalledOnce();
  mocks.get.mockClear();
  mocks.owner = 'other';
  mocks.get.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
  await expect(refreshUserProfile('member')).rejects.toMatchObject({ code: 'ERR_NETWORK' });
  expect(mocks.get).toHaveBeenCalledOnce();
});
it('a failed second read remains unresolved and is not replaced by a cached profile', async () => {
  mocks.get.mockRejectedValue({ response: { status: 503 } });
  await expect(refreshUserProfile('member')).rejects.toMatchObject({ response: { status: 503 } });
  expect(mocks.get).toHaveBeenCalledTimes(2);
});
