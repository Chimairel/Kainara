import { afterEach, expect, it, vi } from 'vitest';
import api from './axios';
import type { AxiosAdapter } from 'axios';
import { beginSubmission, finishSubmission, showSubmissionError } from './submission-attempts';
const mocks = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: mocks }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

it('honors a server wait without replaying mutations or inserting a second error toast', async () => {
  vi.useFakeTimers();
  const adapter = vi.fn<AxiosAdapter>(async config => { throw { config, response: { status: 429, data: { error: 'Too many attempts.', retryAfterSeconds: 2 } } }; });
  const error = await api.post('/auth/login', { email: 'a@example.invalid' }, { adapter }).catch(error => error);
  showSubmissionError(error, 'Failure');
  expect(mocks.error).toHaveBeenCalledOnce();
  await expect(api.post('/auth/login', { email: 'different@example.invalid' }, { adapter })).rejects.toThrow('Please wait');
  expect(adapter).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(2001);
  adapter.mockImplementationOnce(async config => ({ config, data: {}, status: 200, statusText: 'OK', headers: {} }));
  await expect(api.post('/auth/login', {}, { adapter })).resolves.toMatchObject({ status: 200 });
  expect(adapter).toHaveBeenCalledTimes(2);
});

it('a blocked duplicate does not release the active request; success releases it', async () => {
  let resolve!: (value: unknown) => void;
  const adapter = vi.fn<AxiosAdapter>(config => new Promise(done => { resolve = () => done({ config, data: {}, status: 200, statusText: 'OK', headers: {} }); }));
  const first = api.post('/support/requests', {}, { adapter });
  await vi.waitFor(() => expect(adapter).toHaveBeenCalledOnce());
  await expect(api.post('/support/requests', {}, { adapter })).rejects.toThrow('already being sent');
  await expect(api.post('/support/requests', {}, { adapter })).rejects.toThrow('already being sent');
  expect(adapter).toHaveBeenCalledOnce(); resolve({}); await first;
  adapter.mockImplementationOnce(async config => ({ config, data: {}, status: 200, statusText: 'OK', headers: {} }));
  await expect(api.post('/support/requests', {}, { adapter })).resolves.toMatchObject({ status: 200 });
});

it('network failures release the request and polling stays outside the submission gate', async () => {
  const adapter = vi.fn<AxiosAdapter>(async config => { throw { config }; });
  await api.post('/auth/register', {}, { adapter }).catch(() => {});
  await api.post('/auth/register', {}, { adapter }).catch(() => {});
  await Promise.all([api.get('/auth/register', { adapter }).catch(() => {}), api.get('/auth/register', { adapter }).catch(() => {})]);
  expect(adapter).toHaveBeenCalledTimes(4);
});


it('partitions accounts and releases aborted requests without stale notifications', () => {
  const auth = (userId: string) => ({ Authorization: `Bearer fixture.${btoa(JSON.stringify({ userId }))}.fixture` });
  const controller = new AbortController();
  const first = { method: 'post', url: '/support/requests', headers: auth('first'), signal: controller.signal };
  const second = { method: 'post', url: '/support/requests', headers: auth('second') };
  beginSubmission(first); beginSubmission(second);
  controller.abort();
  finishSubmission(first, { response: { status: 429, data: { retryAfterSeconds: 60 } } });
  expect(mocks.error).not.toHaveBeenCalled();
  const again = { method: 'post', url: '/support/requests', headers: auth('first') };
  expect(() => beginSubmission(again)).not.toThrow();
  finishSubmission(again); finishSubmission(second);
});
