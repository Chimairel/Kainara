import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContainerScroll, Card, Header } from './container-scroll-animation';

vi.mock('motion/react', () => ({
  motion: new Proxy({}, { get: (_target, tag: string) => tag }),
  useMotionValue: (init = 0) => ({ get: () => init, set: vi.fn() }),
  animate: vi.fn(() => ({ stop: vi.fn() })),
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: (_value: unknown, _input: unknown, output: unknown) => (Array.isArray(output) ? output[0] : 0),
}));

describe('ContainerScroll', () => {
  it('renders titleComponent, badges, and children inside scroll container', () => {
    render(
      <ContainerScroll
        titleComponent={<h1>Hero Title</h1>}
        badgeLeft={<div>Badge Left</div>}
        badgeRight={<div>Badge Right</div>}
      >
        <p>Mockup Cockpit Content</p>
      </ContainerScroll>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Hero Title' })).toBeInTheDocument();
    expect(screen.getByText('Badge Left')).toBeInTheDocument();
    expect(screen.getByText('Badge Right')).toBeInTheDocument();
    expect(screen.getByText('Mockup Cockpit Content')).toBeInTheDocument();
  });

  it('renders Header and Card standalone components cleanly', () => {
    render(
      <div>
        <Header translate={0 as unknown as import('motion/react').MotionValue<number>} titleComponent={<h2>Header Only</h2>} />
        <Card
          rotate={0 as unknown as import('motion/react').MotionValue<number>}
          scale={1 as unknown as import('motion/react').MotionValue<number>}
        >
          <span>Card Standalone</span>
        </Card>
      </div>
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Header Only' })).toBeInTheDocument();
    expect(screen.getByText('Card Standalone')).toBeInTheDocument();
  });
});
