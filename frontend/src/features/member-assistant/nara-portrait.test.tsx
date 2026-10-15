import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import NaraPortrait, { type NaraMood } from './NaraPortrait';

vi.mock('motion/react', () => ({ useReducedMotion: () => true }));

it('serves both default sprite sheets as square 3x3 WebP atlases with alpha', () => {
  for (const kind of ['directions', 'reactions']) {
    const file = readFileSync(resolve(process.cwd(), `public/mascots/nara-default-${kind}.webp`));
    expect(file.toString('ascii', 0, 4)).toBe('RIFF');
    expect(file.toString('ascii', 8, 16)).toBe('WEBPVP8X');
    expect(file[20] & 0x10).toBe(0x10);
    expect(file.readUIntLE(24, 3) + 1).toBe(1080);
    expect(file.readUIntLE(27, 3) + 1).toBe(1080);
  }
});

it.each<NaraMood>(['front', 'follow', 'thinking', 'failed', 'smile'])('uses the everyday Nara assets in %s mood', mood => {
  const { container } = render(<NaraPortrait mood={mood} />);
  const directions = container.querySelector('[style*="directions"]') as HTMLElement;
  const reactions = container.querySelector('[style*="reactions"]') as HTMLElement;
  expect(directions.style.backgroundImage).toContain('/mascots/nara-default-directions.webp');
  expect(reactions.style.backgroundImage).toContain('/mascots/nara-default-reactions.webp');
  expect(directions.style.backgroundPosition).toBe('50% 50%');
  expect(reactions.style.opacity).toBe(['failed', 'smile'].includes(mood) ? '1' : '0');
  if (mood === 'failed') expect(reactions.style.backgroundPosition).toBe('50% 100%');
  if (mood === 'smile') expect(reactions.style.backgroundPosition).toBe('100% 100%');
  expect(container.querySelector('button')).toBeNull();
});

it.each([32, 40, 48, 88])('keeps the %ipx portrait footprint and uses its verified atlas framing', size => {
  const { container } = render(<NaraPortrait size={size} />);
  const portrait = container.querySelector('[data-nara-mood]') as HTMLElement;
  expect(portrait).toHaveStyle({ width: `${size}px`, height: `${size}px` });
  const canvas = portrait.querySelector('span > span[style]') as HTMLElement;
  expect(canvas).toHaveStyle({ width: `${size * 1.2}px`, height: `${size * 1.2}px` });
});
