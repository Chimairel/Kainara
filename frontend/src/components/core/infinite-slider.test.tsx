import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InfiniteSlider } from './infinite-slider';

const state = vi.hoisted(() => ({ reducedMotion: false, animate: vi.fn(() => ({ stop: vi.fn() })) }));
vi.mock('motion/react', () => ({
  motion: new Proxy({}, { get: (_target, tag: string) => tag }),
  useReducedMotion: () => state.reducedMotion,
  useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  animate: state.animate,
}));

describe('accessible source carousel', () => {
  beforeEach(() => {
    state.reducedMotion = false;
    state.animate.mockClear();
  });

  it('exposes each citation once and removes visual repeats when a link is focused', () => {
    const { container } = render(
      <InfiniteSlider>
        <a href="https://example.test/source">Source</a>
      </InfiniteSlider>
    );
    expect(screen.getAllByRole('link', { name: 'Source' })).toHaveLength(1);
    expect(container.querySelector('[aria-hidden] a')).toHaveAttribute('tabindex', '-1');
    fireEvent.focus(screen.getByRole('link', { name: 'Source' }));
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(container.firstChild).toHaveClass('overflow-auto');
  });

  it('shows a static scrollable list for reduced motion without starting an animation', () => {
    state.reducedMotion = true;
    const { container } = render(
      <InfiniteSlider>
        <a href="https://example.test/source">Source</a>
      </InfiniteSlider>
    );
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(container.firstChild).toHaveClass('overflow-auto');
    expect(state.animate).not.toHaveBeenCalled();
  });
});
