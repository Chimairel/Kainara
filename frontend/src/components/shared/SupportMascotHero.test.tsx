import type { ImgHTMLAttributes } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AuthHeroPanel from '@/components/auth/AuthHeroPanel';
import SupportContact from './SupportContact';
import SupportMascot, { supportMascotAssets } from './SupportMascot';

const state = vi.hoisted(() => ({ preload: vi.fn(), decoded: [] as string[], reject: false }));
vi.mock('react-dom', async (original) => ({ ...await original<typeof import('react-dom')>(), preload: state.preload }));
vi.mock('next/image', () => ({ default: ({ fill, priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
  void fill; void priority;
  // eslint-disable-next-line @next/next/no-img-element -- local DOM test adapter for Next Image
  return <img {...props} alt={props.alt} />;
} }));
vi.mock('@/components/ui/ThemeToggle', () => ({ default: () => <button type="button">Change theme</button> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));

beforeEach(() => {
  state.preload.mockClear(); state.decoded = []; state.reject = false;
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal('Image', class {
    src = '';
    decode() { state.decoded.push(this.src); return state.reject ? Promise.reject(new Error('missing decoration')) : Promise.resolve(); }
  });
});
afterEach(() => vi.unstubAllGlobals());

it('keeps authentication defaults and existing scene/theme controls', async () => {
  const { container } = render(<AuthHeroPanel />);
  await waitFor(() => expect(state.decoded).toHaveLength(2));
  expect(state.decoded).toEqual(['/mascots/nara-tanod-directions.webp', '/mascots/nara-tanod-reactions.webp']);
  expect(container.querySelector('[data-auth-mascot]')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Nara wearing her tanod costume', hidden: true })).toBeInTheDocument();
  expect(container.querySelector('[data-auth-bulb] button')).toHaveTextContent('Change theme');
});

it('preloads VA assets and releases the scene even when decorative assets fail', async () => {
  state.reject = true;
  const { container } = render(<AuthHeroPanel embedded mascot={<SupportMascot size={1024} />} mascotAssets={supportMascotAssets} />);
  const stage = container.querySelector('[data-auth-kubo-stage]')!;
  expect(stage).toHaveAttribute('data-auth-scene-ready', 'false');
  for (const image of container.querySelectorAll('img')) fireEvent.error(image);
  await waitFor(() => expect(stage).toHaveAttribute('data-auth-scene-ready', 'true'));
  expect(stage).not.toHaveAttribute('inert');
  expect(state.decoded).toEqual(Object.values(supportMascotAssets));
  expect(state.preload).toHaveBeenCalledWith(supportMascotAssets.directions, { as: 'image', fetchPriority: 'high' });
  expect(state.preload).toHaveBeenCalledWith(supportMascotAssets.reactions, { as: 'image', fetchPriority: 'high' });
  expect(container.querySelector('[data-auth-mascot]')).not.toBeInTheDocument();
});

it('connects both desktop scene and mobile title to VA while preserving the support form', async () => {
  const { container } = render(<SupportContact />);
  await act(async () => {});
  const mascots = container.querySelectorAll<HTMLElement>('[data-support-mascot]');
  expect(mascots).toHaveLength(2);
  expect([...mascots].map((mascot) => mascot.style.maxWidth).sort()).toEqual(['1024px', '160px']);
  for (const mascot of mascots) expect(mascot.querySelector('[role="img"]')?.getAttribute('style')).toContain(supportMascotAssets.directions);
  expect(container.querySelector('[data-auth-mascot]')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send a support request' })).toHaveAttribute('type', 'submit');
  expect(screen.getByLabelText('Your message')).toHaveAttribute('minlength', '20');
});
